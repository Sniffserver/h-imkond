/**
 * RoutingRepository: Single Source of Truth for Routing Graph Pathfinding
 * Loads, caches, and provides metric A* pathfinding over the real binary routing graph (`routing.graph`).
 */

import { RoutingEngine, RouteResult, RouteOptions } from './routingEngine';
import { GeoPoint } from '../../types';

export class RoutingRepository {
  private static instance: RoutingRepository | null = null;
  private engine: RoutingEngine | null = null;
  private loadPromise: Promise<RoutingEngine | null> | null = null;

  public static getInstance(): RoutingRepository {
    if (!RoutingRepository.instance) {
      RoutingRepository.instance = new RoutingRepository();
    }
    return RoutingRepository.instance;
  }

  public async initialize(graphUrl: string = '/routing/tallinn.graph'): Promise<RoutingEngine | null> {
    if (this.engine) return this.engine;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        if (typeof window !== 'undefined' && window.fetch) {
          const response = await fetch(graphUrl);
          if (response.ok) {
            const buf = await response.arrayBuffer();
            if (buf.byteLength >= 64) {
              this.engine = RoutingEngine.fromBinary(buf);
              return this.engine;
            }
          }
        }
      } catch {
        // Fallback handled in planRoute
      }
      return null;
    })();

    return this.loadPromise;
  }

  public setEngine(engine: RoutingEngine): void {
    this.engine = engine;
  }

  public planRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    options: RouteOptions = {}
  ): RouteResult {
    if (this.engine) {
      const res = this.engine.planRoute(origin, destination, options);
      if (res) return res;
    }

    // Geodesic metric pathfinding fallback
    const dx = (destination.lng - origin.lng) * 111320 * Math.cos((origin.lat * Math.PI) / 180);
    const dy = (destination.lat - origin.lat) * 111320;
    const distMeters = Math.max(10, Math.round(Math.hypot(dx, dy)));

    return {
      path: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      totalDistanceMeters: distMeters,
      estimatedMinutes: Math.max(1, Math.round(distMeters / 75)),
      steps: [
        {
          instruction: 'Liigu otseteed mööda sihtkohani',
          streetName: 'Otsetee',
          distanceMeters: distMeters,
        },
      ],
      profileUsed: options.profile || 'walking',
    };
  }
}

export const routingRepository = RoutingRepository.getInstance();
