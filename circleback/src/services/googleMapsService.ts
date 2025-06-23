import { Loader } from '@googlemaps/js-api-loader';

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

interface CityInfo {
  city: string;
  country: string;
  fullAddress?: string;
  accuracy?: 'high' | 'medium' | 'low';
}

interface LocationResult {
  coordinates: LocationCoordinates;
  cityInfo: CityInfo;
  timestamp: Date;
  source: 'live' | 'cached' | 'fallback';
}

class GoogleMapsService {
  private loader: Loader;
  private geocoder: google.maps.Geocoder | null = null;
  private isInitialized = false;
  
  // Your Google Maps API Key
  private readonly API_KEY: string;

  constructor() {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key is required. Please set REACT_APP_GOOGLE_MAPS_API_KEY environment variable.');
    }
    this.API_KEY = apiKey;
    this.loader = new Loader({
      apiKey: this.API_KEY,
      version: 'weekly',
      libraries: ['geocoding']
    });
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loader.load();
      this.geocoder = new google.maps.Geocoder();
      this.isInitialized = true;
      console.log('[GoogleMaps] Service initialized successfully with API key');
    } catch (error) {
      console.error('[GoogleMaps] Failed to initialize:', error);
      throw new Error('Failed to initialize Google Maps service');
    }
  }

  async getCityFromCoordinates(latitude: number, longitude: number): Promise<CityInfo> {
    await this.initialize();
    
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }

    try {
      const latlng = { lat: latitude, lng: longitude };
      
      const response = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        this.geocoder!.geocode({ location: latlng }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status === 'OK' && results) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      if (!response || response.length === 0) {
        throw new Error('No results found');
      }

      const result = response[0];
      const addressComponents = result.address_components;

      // Extract city and country from address components
      let city = 'Unknown City';
      let country = 'Unknown Country';

      for (const component of addressComponents) {
        const types = component.types;
        
        if (types.includes('locality')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1') && city === 'Unknown City') {
          city = component.long_name;
        } else if (types.includes('country')) {
          country = component.long_name;
        }
      }

      // Determine accuracy based on result type
      let accuracy: 'high' | 'medium' | 'low' = 'medium';
      if (result.types.includes('street_address') || result.types.includes('premise')) {
        accuracy = 'high';
      } else if (result.types.includes('administrative_area_level_2')) {
        accuracy = 'low';
      }

      console.log(`[GoogleMaps] Successfully geocoded: ${city}, ${country} (${accuracy} accuracy)`);

      return {
        city,
        country,
        fullAddress: result.formatted_address,
        accuracy
      };
    } catch (error) {
      console.error('[GoogleMaps] Geocoding error:', error);
      
      // Fallback to OpenStreetMap if Google Maps fails
      return this.fallbackToOpenStreetMap(latitude, longitude);
    }
  }

  private async fallbackToOpenStreetMap(latitude: number, longitude: number): Promise<CityInfo> {
    try {
      console.log('[GoogleMaps] Using OpenStreetMap fallback');
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('OpenStreetMap request failed');
      }
      
      const data = await response.json();
      
      const city = data.address?.city || 
                   data.address?.town || 
                   data.address?.village || 
                   data.address?.municipality || 
                   'Unknown City';
      
      const country = data.address?.country || 'Unknown Country';
      
      return {
        city,
        country,
        fullAddress: data.display_name,
        accuracy: 'medium'
      };
    } catch (error) {
      console.error('[GoogleMaps] OpenStreetMap fallback failed:', error);
      return {
        city: 'Unknown City',
        country: 'Unknown Country',
        accuracy: 'low'
      };
    }
  }

  async getCurrentLocation(): Promise<LocationResult> {
    try {
      const position = await this.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      const cityInfo = await this.getCityFromCoordinates(latitude, longitude);
      
      return {
        coordinates: { latitude, longitude },
        cityInfo,
        timestamp: new Date(),
        source: 'live'
      };
    } catch (error) {
      console.error('[GoogleMaps] Failed to get current location:', error);
      throw error;
    }
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  // Get cached location from localStorage
  getCachedLocation(): LocationResult | null {
    try {
      const cached = localStorage.getItem('lastKnownLocation');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp),
          source: 'cached'
        };
      }
    } catch (error) {
      console.error('[GoogleMaps] Failed to get cached location:', error);
    }
    return null;
  }

  // Cache location to localStorage
  cacheLocation(location: LocationResult): void {
    try {
      localStorage.setItem('lastKnownLocation', JSON.stringify({
        ...location,
        source: 'cached'
      }));
    } catch (error) {
      console.error('[GoogleMaps] Failed to cache location:', error);
    }
  }

  // Check if cached location is still fresh (within 12 hours)
  isCachedLocationFresh(cachedLocation: LocationResult): boolean {
    const now = new Date();
    const cacheTime = new Date(cachedLocation.timestamp);
    const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 12;
  }
}

export const googleMapsService = new GoogleMapsService();
export type { LocationResult, CityInfo, LocationCoordinates }; 