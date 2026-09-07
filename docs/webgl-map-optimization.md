# 🗺️ HÕIMU: WebGL & MapLibre Hardware-Accelerated Map Rendering

> Performance optimization strategies and migration blueprints for rendering high-density topographic contours, vector maps, and thousands of peer nodes at 60 FPS using WebGL.

---

## 🏎️ 1. Why HTML5 2D Canvas Hits a Performance Wall

Currently, HÕIMU uses a customized 2D Canvas rendering pipeline (`BioregionalMapCanvas.tsx`). While highly optimized with focal-point clipping and throttled updates, 2D Canvas hits hardware limitations when handling large datasets:

1. **Main Thread Blocking**: All 2D Canvas drawing commands (`ctx.lineTo`, `ctx.stroke`, `ctx.fill`) execute synchronously on the browser's single main thread, competing with UI animations and message processing.
2. **GPU Upload Overhead**: Every frame requiring zoom or pan forces the CPU to recalculate all vector points and upload them to the GPU frame buffer, creating a bottleneck.
3. **Garbage Collection (GC) Spikes**: Creating and destroying temporary coordinate vectors during pathfinder tracks triggers frequent browser GC sweeps, resulting in frame stuttering (jank).

---

## 💎 2. WebGL Hardware-Acceleration (The MapLibre GL Migration Path)

To render **millions of offline topographic vertices** and complex contours fluently, HÕIMU can migrate to **MapLibre GL** (or a custom lightweight WebGL pipeline). WebGL parallelizes vector calculations directly inside the GPU shaders using compiled vertex arrays.

### 2.1 Package Setup
To enable hardware acceleration, install MapLibre GL:
```bash
npm install maplibre-gl
npm install --save-dev @types/maplibre-gl
```

### 2.2 Dynamic WebGL Map Component Implementation Blueprint

Below is the production-ready React component wrapper for MapLibre GL, utilizing offline vector tiles stored directly in IndexedDB.

```typescript
import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface WebGlMapProps {
  center: [number, number]; // [Longitude, Latitude]
  zoom: number;
  peers: Array<{ id: string; callsign: string; lat: number; lng: number }>;
}

export const WebGlMap: React.FC<WebGlMapProps> = ({ center, zoom, peers }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize MapLibre GL with a custom offline style schema
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          // Serves topography vectors directly from local IndexedDB cache
          'offline-topography-source': {
            type: 'vector',
            tiles: ['indexeddb://tiles/{z}/{x}/{y}.pbf'],
            maxzoom: 14,
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#F4F1DE' },
          },
          {
            id: 'contours',
            type: 'line',
            source: 'offline-topography-source',
            'source-layer': 'contour',
            paint: {
              'line-color': '#E07A5F',
              'line-width': 0.8,
              'line-opacity': 0.6,
            },
          }
        ],
      },
      center: center,
      zoom: zoom,
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Update Peer coordinates dynamically on the GPU thread using GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const geoJsonSource = map.getSource('peers-source') as maplibregl.GeoJSONSource;
    if (geoJsonSource) {
      geoJsonSource.setData({
        type: 'FeatureCollection',
        features: peers.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { callsign: p.callsign },
        })),
      });
    }
  }, [peers]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-[#E7E5E4]">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
```

---

## 🎨 3. Hybrid Layered Architecture (Ultimate Performance)

For complex solarpunk dashboards, the **Hybrid Multi-Canvas Layering** architecture is recommended. This combines WebGL speed with DOM design ease:

```text
┌────────────────────────────────────────────────────────┐
│  Layer 3: Standard DOM & React Tooltips                │  <- Text labels, action menus, click handlers
├────────────────────────────────────────────────────────┤
│  Layer 2: Lightweight 2D Canvas (Peer Animations)      │  <- Pulsing radar circles, active pathfinder line
├────────────────────────────────────────────────────────┤
│  Layer 1: WebGL Canvas (MapLibre Topo Render)          │  <- Static terrain contours, forests, rivers (GPU)
└────────────────────────────────────────────────────────┘
```

- **WebGL Canvas (Bottom)**: Draws heavy, unchanging static structures (elevation curves, grid blocks) with massive parallel throughput.
- **2D Canvas (Middle)**: Animates active target vectors, GPS tracks, and pulsing range rings that change frame-by-frame.
- **HTML DOM (Top)**: Controls user profile badges, menu drawers, and interaction modals, ensuring perfect typography and WCAG AA contrast.
