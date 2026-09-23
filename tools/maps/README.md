# HÕIMU Tactical Offline Vector Maps Pipeline

This directory contains the production toolchain for building serverless, single-file `.pmtiles` vector map packs for **HÕIMU Field Terminal**.

---

## 1. Why PMTiles Instead of Raster Scraping?

### The Problem with Bulk Tile Scraping
Traditional offline mapping apps often attempt to bulk-download thousands of PNG tiles from `tile.openstreetmap.org` across multiple zoom levels (e.g. `downloadRasterTilesForBounds(...)` downloading 500–5,000 `.png` files into `CacheStorage`).

This violates the [OpenStreetMap Foundation Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/):
> *"OpenStreetMap data is free for everyone to use. Our tile servers are not. Bulk downloading is strongly prohibited. Do not use tile.openstreetmap.org for offline downloading or pre-caching."*

In addition, raster tiles:
- Blur and pixelate on high-DPI displays when zooming or rotating.
- Cannot dynamically switch color themes (Day, Night, High-Contrast, Direct Sun, Eco Mode, Crisis Mode).
- Cannot show or filter localized Estonian street names (`name:et`) or hide/show specific infrastructure layers at runtime.
- Generate thousands of slow individual HTTP requests that trigger 429 rate limits.

### The HÕIMU PMTiles Architecture
HÕIMU uses **PMTiles** (Protomaps Single-File Cloud-Optimized Tile Archives):
1. **Single File Asset / Indexed Pack**: The entire Tallinn metropolitan area (Z0–Z15) compresses into a single `tallinn.pmtiles` file (~15–20 MB).
2. **Zero Tile Server Scraping**: The client reads tiles via HTTP Range Requests (or directly from local IndexedDB / OPFS / offline cache) without making any requests to public tile servers.
3. **100% Offline & Resilient**: A single file download provides vector data for streets, buildings, waterways, contours, and place labels.
4. **Local Vector Styling & Theming**: Rendered dynamically via WebGL with MapLibre GL in real-time at 60 FPS.

---

## 2. Multi-Level Zoom Architecture

The compiled vector tile schema is optimized for survival, tactical mesh operations, and civilian emergency coordination:

| Zoom Level | Rendered Features & Geometry | HÕIMU Tactical Context |
| :--- | :--- | :--- |
| **ZOOM 10** | City boundaries, regional districts, major water bodies (Tallinna laht, Ülemiste järv, Harku järv) | Bioregional macro view, mesh cluster summary |
| **ZOOM 12** | Motorways, primary arterial roads (Tallinna ringtee, Pärnu mnt, Tartu mnt, Narva mnt, Paldiski mnt) | Rapid transit routes, evacuation corridors |
| **ZOOM 13** | Secondary roads, rail lines (Elron tracks, tram lines), rivers & canals (Pirita jõgi, Vääna jõgi) | Neighborhood transit & logistics |
| **ZOOM 14** | Residential & tertiary roads, service ways, building footprints, landuse (forests, parks, industrial) | Tactical sector reconnaissance, perimeter patrol |
| **ZOOM 15+** | Full Estonian street names (`name:et`), house numbers, water points, power hubs, shelters, HÕIMU resource pins | Micro-navigation, direct mutual aid, indoor shelter routing |

---

## 3. Estonian Street Localization (`name:et`)

Protomaps & Shortbread schemas support multi-lingual tag extraction from OpenStreetMap. The style engine prioritizes:
1. `name:et` (Official Estonian language name)
2. `name` (Standard primary name)
3. `ref` (Road reference code, e.g. `E263`, `11`, `4`)

Example verified major arteries rendered:
- *Pärnu maantee*, *Narva maantee*, *Tartu maantee*, *Paldiski maantee*
- *Sõpruse puiestee*, *Mustamäe tee*, *Ehitajate tee*, *Akadeemia tee*
- *Liivalaia tänav*, *Endla tänav*, *Toompuiestee*, *Vabaduse puiestee*
- *A. H. Tammsaare tee*, *Järvevana tee*, *Peterburi tee*, *Punane tänav*

---

## 4. 6 Real-Time Tactical Map Themes

The same vector geometry supports instant hardware-accelerated theme switching without re-downloading:

1. **Tactical Day / Topo**: High-clarity natural palette for daylight operations.
2. **Night / Stealth**: Ultra-low luminance OLED dark mode (`#06090f` background) for nighttime operations without light discipline breaches.
3. **High Contrast**: Pure black & vivid yellow/cyan lines for direct legibility through dirty screens or smoke.
4. **Direct Sun (High Albedo)**: Monochromatic amber/paper high-reflection style for direct sunlight visibility.
5. **Eco Mode**: Phosphor green monochromatic style minimizing battery and GPU consumption during low-power emergencies.
6. **Crisis Mode**: Red/Amber alert style highlighting emergency shelters, potable water springs, medical aid stations, and SOS distress beacons.

---

## 5. Build Pipeline Instructions

### Prerequisites
- Bash (`bash`)
- `curl`
- Java 21+ OR Docker (for running Planetiler)
- Optional: `osmium-tool` (for fast polygon clipping)

### Quick Build
To generate the latest `tallinn.pmtiles`:

```bash
chmod +x tools/maps/build-tallinn.sh
./tools/maps/build-tallinn.sh
```

The compiled archive will be saved directly to:
```
public/maps/tallinn.pmtiles
```

### Manual Pipeline Steps
```bash
# 1. Download Geofabrik Estonia extract
curl -O https://download.geofabrik.de/europe/estonia-latest.osm.pbf

# 2. Clip to Tallinn Bioregion
osmium extract -p tools/maps/tallinn.poly estonia-latest.osm.pbf -o tallinn.osm.pbf

# 3. Generate PMTiles using Planetiler
java -Xmx4g -jar planetiler.jar \
  --osm-path=tallinn.osm.pbf \
  --output=public/maps/tallinn.pmtiles \
  --bbox=24.50,59.32,25.00,59.50 \
  --maxzoom=15 \
  --languages=et,en,default
```
