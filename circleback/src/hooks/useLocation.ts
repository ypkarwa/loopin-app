import { useState, useEffect, useCallback } from 'react';
import { LocationState } from '../types';

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
}

interface CityInfo {
  city: string;
  country: string;
}

export const useLocation = () => {
  const [locationState, setLocationState] = useState<LocationState>({
    currentLocation: null,
    isTracking: false,
    lastUpdate: null,
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

  const handleLocationUpdate = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude } = position.coords;
    
    try {
      const cityChanged = await hasLocationChanged(latitude, longitude);
      
      if (cityChanged) {
        const cityInfo = await getCityFromCoordinates(latitude, longitude);
        
        const newLocation = {
          id: Math.random().toString(36).substr(2, 9),
          userId: '',
          city: cityInfo.city,
          country: cityInfo.country,
          isPublic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        setLocationState(prev => ({
          ...prev,
          currentLocation: newLocation,
          lastUpdate: new Date(),
        }));
        
        if (locationState.currentLocation) {
          const shouldMakePublic = window.confirm(
            `You're now in ${cityInfo.city}, ${cityInfo.country}! Do you want to let your circle know you're in town?`
          );
          
          newLocation.isPublic = shouldMakePublic;
          
          if (shouldMakePublic) {
            console.log('Sending notifications to friends in', cityInfo.city);
          }
        }
      }
    } catch (error) {
      console.error('Error handling location update:', error);
      setError('Failed to update location information');
    }
  }, [hasLocationChanged, locationState.currentLocation]);

  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location access denied';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied. Please enable location permissions.';
        setPermissionStatus('denied');
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
      default:
        errorMessage = 'An unknown error occurred while retrieving location.';
        break;
    }
    
    setError(errorMessage);
    setLocationState(prev => ({ ...prev, isTracking: false }));
  }, []);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    try {
      setLocationState(prev => ({ ...prev, isTracking: true }));
      setError(null);
      setPermissionStatus('pending');

      // First try with quick, low accuracy for faster response
      const quickOptions = {
        enableHighAccuracy: false,
        timeout: 5000, // 5 seconds
        maximumAge: 60000, // 1 minute
      };

      // Fallback to high accuracy if quick fails
      const preciseOptions = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 300000, // 5 minutes
      };

      // Try quick location first
      const tryQuickLocation = () => {
        return new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, quickOptions);
        });
      };

      // Try precise location as fallback
      const tryPreciseLocation = () => {
        return new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, preciseOptions);
        });
      };

      try {
        // Try quick location first
        console.log('[Location] Trying quick location detection...');
        const position = await tryQuickLocation();
        console.log('[Location] Quick location success');
        setPermissionStatus('granted');
        await handleLocationUpdate(position);
      } catch (quickError) {
        console.log('[Location] Quick location failed, trying precise location...');
        try {
          const position = await tryPreciseLocation();
          console.log('[Location] Precise location success');
          setPermissionStatus('granted');
          await handleLocationUpdate(position);
        } catch (preciseError) {
          console.error('[Location] Both location attempts failed:', preciseError);
          handleLocationError(preciseError as GeolocationPositionError);
          return;
        }
      }

      // Set up watching with reasonable timeout
      const watchId = navigator.geolocation.watchPosition(
        handleLocationUpdate,
        handleLocationError,
        {
          enableHighAccuracy: false,
          timeout: 15000, // 15 seconds
          maximumAge: 300000, // 5 minutes
        }
      );

      return watchId;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setError('Failed to start location tracking');
      setLocationState(prev => ({ ...prev, isTracking: false }));
    }
  }, [handleLocationUpdate, handleLocationError]);

  // Add a quick location request method
  const requestQuickLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    try {
      setError(null);
      console.log('[Location] Quick location request...');
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: false,
            timeout: 3000, // Very quick - 3 seconds
            maximumAge: 30000, // 30 seconds
          }
        );
      });

      console.log('[Location] Quick location success');
      await handleLocationUpdate(position);
      setPermissionStatus('granted');
    } catch (error) {
      console.error('[Location] Quick location failed:', error);
      // Don't show error for quick requests, just fall back to normal tracking
      startTracking();
    }
  }, [handleLocationUpdate, startTracking]);

  const stopTracking = useCallback((watchId?: number) => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
    setLocationState(prev => ({ ...prev, isTracking: false }));
  }, []);

  useEffect(() => {
    let watchId: number;

    const initializeTracking = async () => {
      if (navigator.geolocation) {
        try {
          watchId = await startTracking() || 0;
        } catch (error) {
          console.error('Error initializing location tracking:', error);
        }
      }
    };

    initializeTracking();

    return () => {
      if (watchId) {
        stopTracking(watchId);
      }
    };
  }, [startTracking, stopTracking]);

  return {
    ...locationState,
    error,
    permissionStatus,
    startTracking,
    stopTracking,
    requestPermission: startTracking,
    requestQuickLocation,
  };
}; 