/**
 * State Management for ExploreMap
 */

import { useState, useCallback } from 'react';
import { MapPlace, GeoPoint, Street } from '../../../types';
import { RouteResult } from '../../../services/routing/routingEngine';
import { TacticalMapTheme } from '../pmtiles';

export interface ExploreMapFilterState {
  showPlaces: boolean;
  showPeers: boolean;
  showResources: boolean;
  showMeshLinks: boolean;
  showSignalTrail: boolean;
  showDiscovery: boolean;
  categoryFilter: string | null;
}

export function useExploreMapState() {
  const [theme, setTheme] = useState<TacticalMapTheme>('night');
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [userLocation, setUserLocation] = useState<GeoPoint>({ lat: 59.4370, lng: 24.7535 });
  
  const [filters, setFilters] = useState<ExploreMapFilterState>({
    showPlaces: true,
    showPeers: true,
    showResources: true,
    showMeshLinks: false,
    showSignalTrail: false,
    showDiscovery: true,
    categoryFilter: null,
  });

  const toggleFilter = useCallback((key: keyof ExploreMapFilterState) => {
    setFilters((prev) => {
      if (typeof prev[key] === 'boolean') {
        return { ...prev, [key]: !prev[key] };
      }
      return prev;
    });
  }, []);

  const setCategoryFilter = useCallback((cat: string | null) => {
    setFilters((prev) => ({ ...prev, categoryFilter: cat }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPlace(null);
    setSelectedStreet(null);
  }, []);

  return {
    theme,
    setTheme,
    selectedPlace,
    setSelectedPlace,
    selectedStreet,
    setSelectedStreet,
    activeRoute,
    setActiveRoute,
    userLocation,
    setUserLocation,
    filters,
    toggleFilter,
    setCategoryFilter,
    clearSelection,
  };
}
