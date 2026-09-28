/**
 * RoutingRepository: Single Source of Truth for Routing Graph Pathfinding
 * Loads, caches, and provides metric A* pathfinding over the real binary routing graph (`routing.graph`).
 */

import { RoutingEngine, RouteResult, RouteOptions, calculateHaversineMeters } from './routingEngine';
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

  public isReady(): boolean {
    return this.engine !== null;
  }

  public getEngine(): RoutingEngine | null {
    return this.engine;
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
            if (buf.byteLength >= 16) {
              this.engine = RoutingEngine.fromBinary(buf);
              return this.engine;
            }
          }
        }
      } catch {
        // Handled cleanly via quality: 'unavailable'
      }
      return null;
    })();

    return this.loadPromise;
  }

  public setEngine(engine: RoutingEngine): void {
    this.engine = engine;
  }

  /**
   * Plans a true pedestrian/cyclist route over the topological street graph.
   * If graph is unavailable or unreachable, strictly returns quality: 'unavailable' (never fakes straight-line walking).
   */
  public planRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    options: RouteOptions = {}
  ): RouteResult {
    if (this.engine) {
      const res = this.engine.planRoute(origin, destination, options);
      if (res) return res;
    }

    // Zero fake truth: strictly unavailable when graph route cannot be constructed
    return {
      path: [],
      totalDistanceMeters: 0,
      estimatedMinutes: 0,
      steps: [],
      profileUsed: options.profile || 'walking',
      quality: 'unavailable',
      errorMessage: this.engine
        ? 'Sihtkohta pole võimalik mööda teedevõrku saavutada'
        : 'Võrguühenduseta teekonnagraaf pole veel valmis',
    };
  }

  /**
   * Explicitly computes a direct geodesic bearing / straight line when requested,
   * clearly labeled with quality: 'estimated'.
   */
  public planDirectBearing(
    origin: GeoPoint,
    destination: GeoPoint
  ): RouteResult {
    const distMeters = calculateHaversineMeters(origin.lat, origin.lng, destination.lat, destination.lng);
    return {
      path: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
      totalDistanceMeters: Math.round(distMeters),
      estimatedMinutes: Math.max(1, Math.round(distMeters / 75)),
      steps: [
        {
          instruction: 'Otsesiht (linnulennult, teedevõrguta)',
          streetName: 'Linnulennuline asimuut',
          distanceMeters: Math.round(distMeters),
        },
      ],
      profileUsed: 'walking',
      quality: 'estimated',
    };
  }
}

export const routingRepository = RoutingRepository.getInstance();
