import { Capacitor } from '@capacitor/core';

export const isPlatform = (platform: string): boolean => {
  return Capacitor.getPlatform() === platform;
};

export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getApiBaseUrl = (): string => {
  // In production, always use the Railway URL for mobile apps
  if (isNative()) {
    return process.env.REACT_APP_API_URL || 'https://loopin-app-production.up.railway.app/api';
  }
  
  // For web, use environment variable or localhost
  return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
};

export const getSocketUrl = (): string => {
  // In production, always use the Railway URL for mobile apps
  if (isNative()) {
    return process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://loopin-app-production.up.railway.app';
  }
  
  // For web, use environment variable or localhost
  return process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
}; 