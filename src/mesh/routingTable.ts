export interface RouteEntry {
  destinationId: string;
  nextHopNodeId: string;
  hopCount: number;
  metric: number;
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
    metric = 1.0
  ): void {
    const existing = this.routes.get(destinationId);
    if (!existing || hopCount < existing.hopCount || Date.now() > existing.expiresAt) {
      this.routes.set(destinationId, {
        destinationId,
        nextHopNodeId,
        hopCount,
        metric,
        viaTransport,
        lastUpdated: Date.now(),
        expiresAt: Date.now() + this.defaultRouteTtlMs,
      });
    }
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
