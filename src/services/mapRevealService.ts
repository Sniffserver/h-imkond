import { GeoPoint } from '../types';

export interface RevealedArea {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  revealedAt: number;
}

export interface MapRevealState {
  revealedAreas: RevealedArea[];
  totalStepsAtLastReveal: number;
  stepsPerReveal: number;
}

// Helper to parse centerCoordsText (e.g. "58.3780° N, 26.7290° E")
export function parseCenterCoords(coordsText: string): { lat: number; lng: number } {
  try {
    const cleaned = coordsText.replace(/°/g, '').replace(/[NESWnesw]/g, '');
    const parts = cleaned.split(',');
    if (parts.length >= 2) {
      let lat = parseFloat(parts[0].trim());
      let lng = parseFloat(parts[1].trim());
      
      // Look for signs based on original string directions
      if (coordsText.toUpperCase().includes('S')) {
        lat = -Math.abs(lat);
      }
      if (coordsText.toUpperCase().includes('W')) {
        lng = -Math.abs(lng);
      }
      
      return { 
        lat: isNaN(lat) ? 58.3780 : lat, 
        lng: isNaN(lng) ? 26.7290 : lng 
      };
    }
  } catch (e) {
    console.warn('Failed to parse coords text:', coordsText, e);
  }
  return { lat: 58.3780, lng: 26.7290 }; // default Tartu
}

// Convert canvas grid coordinate to Latitude/Longitude
export function localGridToGeoPoint(x: number, y: number, coordsText: string): GeoPoint {
  const center = parseCenterCoords(coordsText);
  const METERS_PER_GRID_UNIT = 10.71;
  const dy = y * METERS_PER_GRID_UNIT;
  const dx = x * METERS_PER_GRID_UNIT;
  
  const dLat = dy / 111111;
  const dLng = dx / (111111 * Math.cos((center.lat * Math.PI) / 180));
  
  return {
    latitude: center.lat + dLat,
    longitude: center.lng + dLng,
    timestamp: Date.now(),
  };
}

// Convert Latitude/Longitude back to canvas grid coordinate
export function geoPointToLocalGrid(lat: number, lng: number, coordsText: string): { x: number; y: number } {
  const center = parseCenterCoords(coordsText);
  const METERS_PER_GRID_UNIT = 10.71;
  
  const dLat = lat - center.lat;
  const dLng = lng - center.lng;
  
  const dy = dLat * 111111;
  const dx = dLng * 111111 * Math.cos((center.lat * Math.PI) / 180);
  
  return {
    x: dx / METERS_PER_GRID_UNIT,
    y: dy / METERS_PER_GRID_UNIT,
  };
}

class MapRevealService {
  private state: MapRevealState = {
    revealedAreas: [],
    totalStepsAtLastReveal: 0,
    stepsPerReveal: 100, // 100 sammu = 1 uus ala
  };

  constructor() {
    this.loadState();
  }

  /**
   * Laadi salvestatud olek localStorage'st.
   */
  loadState(): void {
    const saved = localStorage.getItem('hoimu_map_reveal_state');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        if (!Array.isArray(this.state.revealedAreas)) {
          this.state.revealedAreas = [];
        }
      } catch (e) {
        console.warn('Map reveal state corrupted, using defaults');
        this.resetDefaults();
      }
    } else {
      this.resetDefaults();
    }
  }

  private resetDefaults(): void {
    this.state = {
      revealedAreas: [],
      totalStepsAtLastReveal: 0,
      stepsPerReveal: 100,
    };
  }

  /**
   * Salvesta olek localStorage'sse.
   */
  saveState(): void {
    try {
      localStorage.setItem('hoimu_map_reveal_state', JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save map reveal state:', e);
    }
  }

  /**
   * Kontrolli, kas uus sammude arv võimaldab uue ala avada.
   * Kui jah, ava ala kasutaja praeguse asukoha ümber.
   */
  checkForReveal(currentSteps: number, userLocation: GeoPoint): RevealedArea | null {
    const stepsSinceLastReveal = currentSteps - this.state.totalStepsAtLastReveal;
    
    if (stepsSinceLastReveal >= this.state.stepsPerReveal) {
      const newArea: RevealedArea = {
        centerLat: userLocation.latitude,
        centerLng: userLocation.longitude,
        radiusMeters: 50, // 50m raadius
        revealedAt: Date.now(),
      };
      
      this.state.revealedAreas.push(newArea);
      this.state.totalStepsAtLastReveal = currentSteps;
      this.saveState();
      
      return newArea;
    }
    
    return null;
  }

  /**
   * Kontrolli, kas antud punkt on juba avastatud.
   */
  isPointRevealed(lat: number, lng: number): boolean {
    if (this.state.revealedAreas.length === 0) {
      return false;
    }
    return this.state.revealedAreas.some(area => {
      const distance = this.calculateDistance(lat, lng, area.centerLat, area.centerLng);
      return distance <= area.radiusMeters;
    });
  }

  /**
   * Arvuta kahe punkti vaheline kaugus meetrites (Haversine valem).
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Maa raadius meetrites
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = 
      Math.sin(dLat / 2) ** 2 + 
      Math.cos((lat1 * Math.PI) / 180) * 
        Math.cos((lat2 * Math.PI) / 180) * 
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /**
   * Tagasta kõik avastatud alad.
   */
  getRevealedAreas(): RevealedArea[] {
    return this.state.revealedAreas;
  }

  /**
   * Määra sammude arv, mis on vajalik ühe ala avamiseks.
   */
  setStepsPerReveal(steps: number): void {
    this.state.stepsPerReveal = steps;
    this.saveState();
  }

  /**
   * Lähtesta kõik avastatud alad.
   */
  resetAll(): void {
    this.state.revealedAreas = [];
    this.state.totalStepsAtLastReveal = 0;
    this.saveState();
  }
}

export const mapRevealService = new MapRevealService();
