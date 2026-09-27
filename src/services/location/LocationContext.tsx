import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GeoFix, GeoPoint } from '../../types';
import { locationManager, LocationManager } from './LocationManager';
import { LocationProviderType, LocationProviderInfo } from './LocationProvider';
import { streetDiscoveryService } from '../../features/map/streets/streetDiscoveryService';

export interface LocationContextValue {
  currentFix: GeoFix | null;
  userLocation: GeoPoint;
  accuracyMeters: number | undefined;
  status: 'live' | 'acquired' | 'unavailable' | 'stale';
  activeProviderType: LocationProviderType;
  availableProviders: LocationProviderInfo[];
  setProvider: (type: LocationProviderType) => Promise<void>;
  startLocation: () => Promise<void>;
  stopLocation: () => Promise<void>;
}

const DEFAULT_TALLINN_CENTER: GeoPoint = { lat: 59.4370, lng: 24.7535 };

const LocationContext = createContext<LocationContextValue>({
  currentFix: null,
  userLocation: DEFAULT_TALLINN_CENTER,
  accuracyMeters: undefined,
  status: 'unavailable',
  activeProviderType: 'browser',
  availableProviders: [],
  setProvider: async () => {},
  startLocation: async () => {},
  stopLocation: async () => {},
});

export const LocationContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentFix, setCurrentFix] = useState<GeoFix | null>(locationManager.getLastFix());
  const [activeProviderType, setActiveProviderType] = useState<LocationProviderType>(
    locationManager.getActiveProviderType()
  );

  useEffect(() => {
    // Single LocationManager Subscription for the entire app
    const unsubscribe = locationManager.subscribe((fix) => {
      setCurrentFix(fix);

      // Process street discovery through the single canonical location stream
      if (fix && fix.accuracyMeters !== undefined && fix.accuracyMeters <= 35) {
        streetDiscoveryService.processGPSFix(fix);
      }
    });

    // Start LocationManager active provider
    locationManager.start().catch((err) => {
      console.warn('[LocationContext] Failed to start location provider:', err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSetProvider = async (type: LocationProviderType) => {
    await locationManager.setProvider(type);
    setActiveProviderType(locationManager.getActiveProviderType());
    const lastFix = locationManager.getLastFix();
    if (lastFix) {
      setCurrentFix(lastFix);
    }
  };

  const startLocation = async () => {
    await locationManager.start();
  };

  const stopLocation = async () => {
    await locationManager.stop();
  };

  const userLocation: GeoPoint = currentFix
    ? { lat: currentFix.lat, lng: currentFix.lng }
    : DEFAULT_TALLINN_CENTER;

  const status: 'live' | 'acquired' | 'unavailable' | 'stale' = currentFix
    ? (Date.now() - currentFix.timestamp > 30000 ? 'stale' : 'live')
    : 'unavailable';

  const value: LocationContextValue = {
    currentFix,
    userLocation,
    accuracyMeters: currentFix?.accuracyMeters,
    status,
    activeProviderType,
    availableProviders: locationManager.getAvailableProviders(),
    setProvider: handleSetProvider,
    startLocation,
    stopLocation,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export function useLocation(): LocationContextValue {
  return useContext(LocationContext);
}
