import { GeoFix, LocationProvider } from '../../types';

export type { LocationProvider };

export type LocationProviderType = 
  | 'browser'
  | 'android'
  | 'gnss_serial'
  | 'mesh_triangulation'
  | 'replay';

export interface LocationProviderInfo {
  id: LocationProviderType;
  name: string;
  description: string;
  sourceType: 'hardware' | 'os' | 'mesh' | 'simulation';
  available: boolean;
}
