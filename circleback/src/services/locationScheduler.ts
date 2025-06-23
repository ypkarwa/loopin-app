import { googleMapsService, LocationResult } from './googleMapsService';

interface ScheduledTime {
  hour: number;
  minute: number;
  label: string;
}

interface LocationUpdate {
  timestamp: Date;
  location: LocationResult;
  success: boolean;
  error?: string;
}

class LocationScheduler {
  private scheduledTimes: ScheduledTime[] = [
    { hour: 8, minute: 0, label: 'Morning' },
    { hour: 14, minute: 0, label: 'Afternoon' },
    { hour: 20, minute: 0, label: 'Evening' }
  ];

  private intervals: NodeJS.Timeout[] = [];
  private isActive = false;
  private lastUpdateHistory: LocationUpdate[] = [];
  private maxHistorySize = 10;

  // Callbacks for location updates
  private onLocationUpdate?: (location: LocationResult) => void;
  private onLocationError?: (error: string) => void;

  constructor() {
    this.loadUpdateHistory();
  }

  start(onLocationUpdate?: (location: LocationResult) => void, onLocationError?: (error: string) => void): void {
    if (this.isActive) {
      console.log('[LocationScheduler] Already active');
      return;
    }

    this.onLocationUpdate = onLocationUpdate;
    this.onLocationError = onLocationError;
    this.isActive = true;

    console.log('[LocationScheduler] Starting automatic location updates');
    
    // Schedule updates for each time slot
    this.scheduledTimes.forEach(time => {
      this.scheduleUpdate(time);
    });

    // Try to get initial location immediately
    this.tryLocationUpdate('Initial');
  }

  stop(): void {
    if (!this.isActive) return;

    console.log('[LocationScheduler] Stopping automatic location updates');
    
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isActive = false;
  }

  private scheduleUpdate(time: ScheduledTime): void {
    const scheduleNextUpdate = () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(time.hour, time.minute, 0, 0);

      // If the scheduled time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const timeUntilUpdate = scheduledTime.getTime() - now.getTime();
      
      console.log(`[LocationScheduler] Next ${time.label} update scheduled for ${scheduledTime.toLocaleString()}`);

      const timeout = setTimeout(() => {
        this.tryLocationUpdate(time.label);
        scheduleNextUpdate(); // Schedule the next occurrence
      }, timeUntilUpdate);

      this.intervals.push(timeout);
    };

    scheduleNextUpdate();
  }

  private async tryLocationUpdate(label: string): Promise<void> {
    console.log(`[LocationScheduler] Attempting ${label} location update`);
    
    try {
      // First try to get live location
      const location = await googleMapsService.getCurrentLocation();
      
      // Cache the successful location
      googleMapsService.cacheLocation(location);
      
      // Record the update
      this.recordUpdate(location, true);
      
      console.log(`[LocationScheduler] ${label} location update successful:`, location.cityInfo);
      
      // Notify callback
      if (this.onLocationUpdate) {
        this.onLocationUpdate(location);
      }
      
    } catch (error) {
      console.log(`[LocationScheduler] ${label} live location failed, trying cached location`);
      
      // Try to use cached location
      const cachedLocation = googleMapsService.getCachedLocation();
      
      if (cachedLocation && googleMapsService.isCachedLocationFresh(cachedLocation)) {
        console.log(`[LocationScheduler] Using fresh cached location for ${label}`);
        
        // Update the timestamp but keep it as cached
        const updatedCachedLocation: LocationResult = {
          ...cachedLocation,
          timestamp: new Date(),
          source: 'cached'
        };
        
        this.recordUpdate(updatedCachedLocation, true);
        
        if (this.onLocationUpdate) {
          this.onLocationUpdate(updatedCachedLocation);
        }
      } else {
        // No fresh cached location available
        const errorMessage = `Failed to get ${label} location: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[LocationScheduler] ${errorMessage}`);
        
        this.recordUpdate(null, false, errorMessage);
        
        if (this.onLocationError) {
          this.onLocationError(errorMessage);
        }
      }
    }
  }

  private recordUpdate(location: LocationResult | null, success: boolean, error?: string): void {
    const update: LocationUpdate = {
      timestamp: new Date(),
      location: location || {} as LocationResult,
      success,
      error
    };

    this.lastUpdateHistory.unshift(update);
    
    // Keep only the last N updates
    if (this.lastUpdateHistory.length > this.maxHistorySize) {
      this.lastUpdateHistory = this.lastUpdateHistory.slice(0, this.maxHistorySize);
    }

    // Save history to localStorage
    this.saveUpdateHistory();
  }

  private saveUpdateHistory(): void {
    try {
      localStorage.setItem('locationUpdateHistory', JSON.stringify(this.lastUpdateHistory));
    } catch (error) {
      console.error('[LocationScheduler] Failed to save update history:', error);
    }
  }

  private loadUpdateHistory(): void {
    try {
      const history = localStorage.getItem('locationUpdateHistory');
      if (history) {
        this.lastUpdateHistory = JSON.parse(history).map((update: any) => ({
          ...update,
          timestamp: new Date(update.timestamp)
        }));
      }
    } catch (error) {
      console.error('[LocationScheduler] Failed to load update history:', error);
      this.lastUpdateHistory = [];
    }
  }

  // Manual location update (for refresh button)
  async forceUpdate(): Promise<LocationResult> {
    console.log('[LocationScheduler] Manual location update requested');
    
    try {
      const location = await googleMapsService.getCurrentLocation();
      googleMapsService.cacheLocation(location);
      this.recordUpdate(location, true);
      
      if (this.onLocationUpdate) {
        this.onLocationUpdate(location);
      }
      
      return location;
    } catch (error) {
      // Try cached location as fallback
      const cachedLocation = googleMapsService.getCachedLocation();
      if (cachedLocation) {
        console.log('[LocationScheduler] Manual update failed, using cached location');
        return cachedLocation;
      }
      
      const errorMessage = `Manual location update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.recordUpdate(null, false, errorMessage);
      
      if (this.onLocationError) {
        this.onLocationError(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
  }

  // Get the most recent location (from cache or history)
  getCurrentBestLocation(): LocationResult | null {
    // First check cache
    const cachedLocation = googleMapsService.getCachedLocation();
    if (cachedLocation) {
      return cachedLocation;
    }

    // Then check update history
    const lastSuccessfulUpdate = this.lastUpdateHistory.find(update => update.success && update.location);
    if (lastSuccessfulUpdate) {
      return lastSuccessfulUpdate.location;
    }

    return null;
  }

  // Get update statistics
  getUpdateStats(): {
    totalUpdates: number;
    successfulUpdates: number;
    failedUpdates: number;
    lastSuccessfulUpdate?: Date;
    lastFailedUpdate?: Date;
  } {
    const totalUpdates = this.lastUpdateHistory.length;
    const successfulUpdates = this.lastUpdateHistory.filter(update => update.success).length;
    const failedUpdates = totalUpdates - successfulUpdates;
    
    const lastSuccessful = this.lastUpdateHistory.find(update => update.success);
    const lastFailed = this.lastUpdateHistory.find(update => !update.success);

    return {
      totalUpdates,
      successfulUpdates,
      failedUpdates,
      lastSuccessfulUpdate: lastSuccessful?.timestamp,
      lastFailedUpdate: lastFailed?.timestamp
    };
  }

  // Get next scheduled update times
  getNextUpdateTimes(): { label: string; time: Date }[] {
    const now = new Date();
    
    return this.scheduledTimes.map(time => {
      const nextTime = new Date();
      nextTime.setHours(time.hour, time.minute, 0, 0);
      
      // If the time has passed today, schedule for tomorrow
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
      
      return {
        label: time.label,
        time: nextTime
      };
    });
  }
}

export const locationScheduler = new LocationScheduler();
export type { LocationUpdate, ScheduledTime }; 