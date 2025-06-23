import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { isNative } from '../utils/platform';
import { googleMapsService, LocationResult } from '../services/googleMapsService';
import { locationScheduler } from '../services/locationScheduler';

interface CityInfo {
  city: string;
  country: string;
}

interface LocationData {
  id: string;
  userId: string;
  city: string;
  country: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  accuracy?: 'high' | 'medium' | 'low';
  source?: 'live' | 'cached' | 'fallback';
  fullAddress?: string;
}

interface LocationState {
  currentLocation: LocationData | null;
  isTracking: boolean;
  lastUpdate: Date | null;
  nextScheduledUpdates: { label: string; time: Date }[];
}

interface LocationStats {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  lastSuccessfulUpdate?: Date;
  lastFailedUpdate?: Date;
}

interface UseLocationReturn extends LocationState {
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'pending';
  updateLocation: () => Promise<void>;
  startTracking: () => () => void;
  getLocationStats: () => LocationStats;
  isLocationFresh: () => boolean;
  isSchedulerActive: boolean;
  locationSource: string;
}

export const useLocation = (): UseLocationReturn => {
  const [locationState, setLocationState] = useState<LocationState>({
    currentLocation: null,
    isTracking: false,
    lastUpdate: null,
    nextScheduledUpdates: []
  });
  
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'pending'>('pending');

  const getCityFromCoordinates = async (latitude: number, longitude: number): Promise<CityInfo> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }
      
      const data = await response.json();
      
      const city = data.address?.city || 
                   data.address?.town || 
                   data.address?.village || 
                   data.address?.municipality || 
                   'Unknown City';
      
      const country = data.address?.country || 'Unknown Country';
      
      return { city, country };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return { city: 'Unknown City', country: 'Unknown Country' };
    }
  };

  const hasLocationChanged = useCallback(async (newLatitude: number, newLongitude: number): Promise<boolean> => {
    if (!locationState.currentLocation) return true;
    
    const newCityInfo = await getCityFromCoordinates(newLatitude, newLongitude);
    
    return newCityInfo.city !== locationState.currentLocation.city;
  }, [locationState.currentLocation]);

  // Convert LocationResult to LocationData format
  const convertLocationResult = useCallback((locationResult: LocationResult): LocationData => {
    return {
      id: Math.random().toString(36).substr(2, 9),
      userId: 'current-user', // This will be set by the component using this hook
      city: locationResult.cityInfo.city,
      country: locationResult.cityInfo.country,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: locationResult.timestamp,
      accuracy: locationResult.cityInfo.accuracy,
      source: locationResult.source,
      fullAddress: locationResult.cityInfo.fullAddress
    };
  }, []);

  // Handle location updates from scheduler
  const handleLocationUpdate = useCallback((locationResult: LocationResult) => {
    console.log('[useLocation] Received scheduled location update:', locationResult);
    
    const locationData = convertLocationResult(locationResult);
    
    setLocationState(prev => ({
      ...prev,
      currentLocation: locationData,
      lastUpdate: locationResult.timestamp,
      isTracking: false
    }));
    
    setError(null);
  }, [convertLocationResult]);

  // Handle location errors from scheduler
  const handleLocationError = useCallback((errorMessage: string) => {
    console.error('[useLocation] Location error:', errorMessage);
    setError(errorMessage);
    setLocationState(prev => ({ ...prev, isTracking: false }));
  }, []);

  // Initialize location scheduler
  useEffect(() => {
    console.log('[useLocation] Initializing location scheduler');
    
    // Start the scheduler with callbacks
    locationScheduler.start(handleLocationUpdate, handleLocationError);
    
    // Get next scheduled update times
    const nextUpdates = locationScheduler.getNextUpdateTimes();
    setLocationState(prev => ({
      ...prev,
      nextScheduledUpdates: nextUpdates
    }));

    // Try to get the best available location immediately
    const bestLocation = locationScheduler.getCurrentBestLocation();
    if (bestLocation) {
      const locationData = convertLocationResult(bestLocation);
      setLocationState(prev => ({
        ...prev,
        currentLocation: locationData,
        lastUpdate: bestLocation.timestamp
      }));
    }

    return () => {
      locationScheduler.stop();
    };
  }, [handleLocationUpdate, handleLocationError, convertLocationResult]);

  // Fallback geolocation for mobile devices
  const getCurrentPositionFallback = async (): Promise<GeolocationPosition | null> => {
    try {
      if (isNative()) {
        // Use Capacitor Geolocation for mobile
        const permissions = await Geolocation.checkPermissions();
        
        if (permissions.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            setPermissionStatus('denied');
            setError('Location permission denied');
            return null;
          }
        }
        
        setPermissionStatus('granted');
        
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });
        
        // Convert Capacitor position to standard GeolocationPosition format
        return {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed
          },
          timestamp: position.timestamp
        } as GeolocationPosition;
      } else {
        // Use browser geolocation for web
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              setPermissionStatus('granted');
              resolve(position);
            },
            (error) => {
              setPermissionStatus('denied');
              setError(error.message);
              reject(error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000 // 5 minutes
            }
          );
        });
      }
    } catch (error: any) {
      console.error('Error getting current position:', error);
      setError(error.message || 'Failed to get location');
      return null;
    }
  };

  // Manual location update
  const updateLocation = useCallback(async () => {
    if (locationState.isTracking) return;

    try {
      setLocationState(prev => ({ ...prev, isTracking: true }));
      setError(null);

      console.log('[useLocation] Manual location update requested');
      
      // Use the location scheduler's force update method
      const locationResult = await locationScheduler.forceUpdate();
      
      const locationData = convertLocationResult(locationResult);
      
      setLocationState(prev => ({
        ...prev,
        currentLocation: locationData,
        lastUpdate: locationResult.timestamp,
        isTracking: false,
        nextScheduledUpdates: locationScheduler.getNextUpdateTimes()
      }));

    } catch (error: any) {
      console.error('Manual location update error:', error);
      setError(error.message || 'Failed to update location');
      setLocationState(prev => ({ ...prev, isTracking: false }));
    }
  }, [locationState.isTracking, convertLocationResult]);

  // Start tracking (legacy compatibility)
  const startTracking = useCallback(() => {
    // The scheduler is already running, but we can trigger an immediate update
    updateLocation();
    
    // Return a cleanup function for compatibility
    return () => {
      console.log('[useLocation] Tracking cleanup called');
    };
  }, [updateLocation]);

  // Get location update statistics
  const getLocationStats = useCallback((): LocationStats => {
    return locationScheduler.getUpdateStats();
  }, []);

  // Check if location is fresh (updated within last 8 hours)
  const isLocationFresh = useCallback((): boolean => {
    if (!locationState.lastUpdate) return false;
    
    const now = new Date();
    const hoursDiff = (now.getTime() - locationState.lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 8;
  }, [locationState.lastUpdate]);

  return {
    ...locationState,
    error,
    permissionStatus,
    updateLocation,
    startTracking,
    getLocationStats,
    isLocationFresh,
    // Additional status information
    isSchedulerActive: true,
    locationSource: locationState.currentLocation?.source || 'unknown'
  };
}; 