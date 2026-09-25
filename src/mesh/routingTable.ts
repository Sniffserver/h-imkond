/**
 * HÕIMU Mesh Routing Table
 * Tracks next-hop routes, hop counts, link quality, and ETX metrics for unicast delivery.
 */

export interface RouteEntry {
  destinationId: string;
  nextHopNodeId: string;
  hopCount: number;
  metric: number;
  etx: number;
  lqScore: number;
  routeCost: number; // lower is better: hopCount * etx / (lqScore / 100)
  viaTransport: string;
  lastUpdated: number;
  expiresAt: number;
}

export class RoutingTable {
  private routes = new Map<string, RouteEntry>();
  private defaultRouteTtlMs = 30 * 60 * 1000; // 30 minutes

  public updateRoute(
    destinationId: string,
    nextHopNodeId: string,
    hopCount: number,
    viaTransport: string,
    metric = 1.0,
    etx = 1.0,
    lqScore = 80
  ): RouteEntry {
    const existing = this.routes.get(destinationId);
    const now = Date.now();
    const routeCost = Math.round((hopCount * Math.max(1, etx) * (100 / Math.max(10, lqScore))) * 100) / 100;

    const isBetterRoute =
      !existing ||
      now > existing.expiresAt ||
      routeCost < existing.routeCost ||
      (routeCost === existing.routeCost && hopCount < existing.hopCount);

    if (isBetterRoute) {
      const entry: RouteEntry = {
        destinationId,
        nextHopNodeId,
        hopCount,
        metric,
        etx,
        lqScore,
        routeCost,
        viaTransport,
        lastUpdated: now,
        expiresAt: now + this.defaultRouteTtlMs,
      };
      this.routes.set(destinationId, entry);
      return entry;
    }

    return existing;
  }

  public getRoute(destinationId: string): RouteEntry | null {
    const route = this.routes.get(destinationId);
    if (!route) return null;
    if (Date.now() > route.expiresAt) {
      this.routes.delete(destinationId);
      return null;
    }
    return route;
  }

  public invalidateRoute(destinationId: string): void {
    this.routes.delete(destinationId);
  }

  public getAllRoutes(): RouteEntry[] {
    const now = Date.now();
    const active: RouteEntry[] = [];
    for (const [dest, route] of this.routes.entries()) {
      if (now > route.expiresAt) {
        this.routes.delete(dest);
      } else {
        active.push(route);
      }
    }
    return active;
  }

  public clear(): void {
    this.routes.clear();
  }
}
