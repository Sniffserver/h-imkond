# HÕIMU Map Data Truth Matrix & v0.3 Roadmap

> **Core Axiom**: *Do not decorate the bridge before verifying it crosses the river.*  
> Real data $\rightarrow$ Real map $\rightarrow$ Real routing $\rightarrow$ Real discovery $\rightarrow$ Real mesh observations $\rightarrow$ Then beautification.

---

## 1. Data Truth Matrix

| Layer / Feature | Canonical Source | Freshness Model | Offline Mode | Authority Tier | Verification Guarantee |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Roads & Streets** | OpenStreetMap + Tallinn Geoportal | Static Snapshot / Map Pack | ✅ | **Mixed** (Gov + OpenStreetMap) | Topology verified by `maps:verify` |
| **Official Addresses** | Maa-amet ADS Register | Monthly / Live Extract | ✅ | **Official** (State Register) | ADS ID cross-referenced |
| **Civil Shelters** | Päästeamet Civil Protection | Release Snapshot | ✅ | **Official** (Päästeamet) | State rescue department ID |
| **Commercial POIs & Shops**| OpenStreetMap Vector Ingestion | Periodic Snapshot | ✅ | **Community** (ODbL) | OSM Node/Way tag validation |
| **Mutual Aid & Tool Libraries** | HÕIMU Community Ledger | Live CRDT / Local DB | ✅ | **Observed** (Signed Peer Posts) | Ed25519 author signature |
| **Mesh Network Topology** | Live RF Radio Packets (LoRa/BLE) | Real-time Heartbeats | ✅ | **Measured** (Hardware Fixes) | Physical RSSI/SNR signal trail |
| **LoRa Radio Coverage** | Bioregional RF Propagation Model | Dynamic Calculation | ✅ | **Estimated** (Modelled) | Explicitly labeled as estimated |

---

## 2. Provenance UI Archetypes

The UI must never choose silently when sources conflict, nor disguise simulated fixture data as live authoritative truth:

### A. Official State Dataset
```text
Avalik varjumiskoht
🚨 Safety
Päästeamet · Official dataset
Updated: Today · Source ID: PA-VARJ-01
```

### B. OpenStreetMap Community POI
```text
Bauhaus Lasnamäe
🛠 Hardware
OpenStreetMap · Community dataset
Updated: 3 days ago · ODbL
```

### C. Live HÕIMU Observation
```text
✨ HÕIMU Mutual Aid Tool Library
Community observation
3 nodes confirmed · Verified: yesterday
```

### D. Modelled / Estimated Telemetry
```text
📡 Estimated LoRa Coverage
Modelled RF propagation · Not direct physical observation
```

### E. Development Fixture / Simulated
```text
🧪 SIMULATED FIXTURE
Isolated test data · Not part of production truth
```

---

## 3. HÕIMU v0.3 Roadmap

### Phase 0 — Truth Lock (Zero Synthetic Invariants)
- [x] **GEO-001**: Canonical `GeoPoint` (`{ lat, lng }`) across all domains.
- [x] **GEO-002**: Canonical `GeoFix` with accuracy, speed, altitude, and timestamp.
- [x] **GEO-003**: Remove latitude/longitude aliases and planar projections in domain state.
- [x] **GEO-004**: Purge canvas $x/y$ coordinates from storage and POI domain models.
- [x] **GEO-005**: Consolidate `SurvivalPoi` into canonical `MapPlace`.
- [x] **DATA-001**: Strict fixture isolation (`src/data/fixtures/**` forbidden in production imports).
- [x] **DATA-002**: Multi-source provenance model (`sources[]` and `conflicts[]`).
- [x] **DATA-003**: Ban unverified "official" claims.

### Phase 1 — Real Tallinn Data Pipeline
- [x] **DATA-010**: OSM vector extraction via Overpass API / Osmosis.
- [x] **DATA-011**: Tallinn Open Data API integration (springs, parks, municipal hubs).
- [x] **DATA-012**: Tallinn Geoportal spatial ingestion.
- [x] **DATA-013**: Maa-amet ADS Estonian official address ingestion.
- [x] **DATA-014**: Päästeamet public shelters and civil emergency registers.
- [x] **DATA-015**: Heterogeneous source normalization.
- [x] **DATA-016**: Spatial deduplication & coordinate clustering ($< 35\text{m}$).
- [x] **DATA-017**: General conflict detection (`sources_disagree` badge).
- [x] **DATA-018**: License and attribution metadata tracking.

### Phase 2 — Real Map Pack Generation
- [x] **PACK-001**: Single-file PMTiles basemap (`tallinn-basemap.pmtiles`).
- [x] **PACK-002**: Tallinn POI vector PMTiles (`tallinn-poi.pmtiles`).
- [x] **PACK-003**: Compact binary street index (`street-index.bin`).
- [x] **PACK-004**: Offline search index (`PlaceSearchIndex`).
- [x] **PACK-005**: Pedestrian routing topology graph (`routing.graph`).
- [x] **PACK-006**: Generated cryptographic manifest (`manifest.json`).
- [x] **PACK-007**: SHA-256 checksum generation for all artifacts.
- [x] **PACK-008**: Gandalf Gate #2 verification script (`npm run maps:verify`).
- [x] **PACK-009**: Clean checkout reproducible rebuild (`rm -rf src/data/generated && npm run build`).

### Phase 3 — Single MapLibre Vector Engine
- [x] **MAP-001**: Canonical `ExploreMap.tsx` renderer.
- [x] **MAP-002**: Native PMTiles protocol integration.
- [x] **MAP-003**: Hardware-accelerated roads, buildings, water, and park vector layers.
- [x] **MAP-004**: Dynamic GeoJSON user and GPS position overlay.
- [x] **MAP-005**: Canonical `MapPlace` POI vector layer.
- [x] **MAP-006**: Dynamic mesh peer overlay.
- [x] **MAP-007**: Community resource overlay.
- [x] **MAP-008**: Offline A* walking route vector layer.
- [x] **MAP-009**: Segment-based street discovery layer.
- [x] **MAP-010**: Hardware radio Signal Trail layer.

### Phase 4 — Street Explorer & Spatial Discovery
- [x] **STREET-001**: 200+ canonical Tallinn street segments across 10 districts.
- [x] **STREET-002**: Sub-segmentation with individual discovery states.
- [x] **STREET-003**: Lightweight $O(1)$ spatial grid hash index (`SpatialSegmentIndex`).
- [x] **STREET-004**: Trace evidence validation (accuracy $\le 35\text{m}$, movement $\ge 15\text{m}$, 2+ consecutive points).
- [x] **STREET-005**: Trace confidence rating (`low`, `medium`, `high`) based on GPS quality.
- [x] **STREET-006**: Length-weighted exploration calculations.
- [x] **STREET-007**: Fast street name and district search.
- [x] **STREET-008**: District-level exploration intelligence (`NeighborhoodIntelligenceService`).

### Phase 5 — Offline Pedestrian Routing
- [x] **ROUTE-001**: Contraction-hierarchy / A* graph over walkable Tallinn paths.
- [x] **ROUTE-002**: Nearest graph node snapping.
- [x] **ROUTE-003**: Bidirectional A* heuristic traversal.
- [x] **ROUTE-004**: Route GeoJSON linestring generation with turn-by-turn guidance.
- [x] **ROUTE-005**: Responsive route overlay with elevation & walking time estimates.
- [x] **ROUTE-006**: 100% offline routing execution with zero network roundtrips.

### Phase 6 — Universal POI Taxonomy & Deterministic Search
- [x] **PLACE-001**: Unified `MapPlace` canonical model.
- [x] **PLACE-002**: 11-category universal taxonomy (`Safety`, `Tools`, `Stores`, `Food`, `Health`, `Mobility`, `Nature`, `Water`, `Community`, `Finds`, `HÕIMU`).
- [x] **PLACE-003**: Estonian colloquial aliases (`riistapood`, `uuskasutus`, `varjend`, `allikas`).
- [x] **PLACE-004**: Offline Inverted Token & Prefix index (`PlaceSearchIndex`).
- [x] **PLACE-005**: Deterministic ranking without synthetic relevance numbers.
- [x] **PLACE-006**: Data provenance cards with full source breakdown and conflict detection.
- [x] **PLACE-007**: "What Have I Not Seen?" / Unknown Nearby exploration loop.

### Phase 7 — Mesh Geography & Hardware Observation Abstraction
- [x] **MESHMAP-001**: Geographic mesh peer positioning.
- [x] **MESHMAP-002**: Direct link telemetry (RSSI, SNR).
- [x] **MESHMAP-003**: Store-and-forward relay path tracing.
- [x] **MESHMAP-004**: Multi-source `ObservationProvider` (`LoRa`, `BLE`, `Wi-Fi`, `MeshBridge`, `Replay`).
- [x] **MESHMAP-005**: Universal `ObservationManager` signal trail ring buffer.
- [x] **MESHMAP-006**: Multi-source `LocationProvider` (`Browser`, `Android`, `GNSSSerial`, `MeshTriangulation`, `Replay`).

### Phase 8 — HÕIMU Field Loop & Quests
- [x] **FIELD-001**: What Have I Not Seen? (`UnknownNearbySheet.tsx`).
- [x] **FIELD-002**: Neighborhood Intelligence (`NeighborhoodIntelligenceSheet.tsx`).
- [x] **FIELD-003**: Authentic Field Quests with real physical objectives (`FieldQuestSheet.tsx`).
- [x] **FIELD-004**: Physical device testing mode (`LocationProviderSelector.tsx`).

### Phase 9 — CI Gates & Invariant Enforcement
- [x] **QA-001**: Gandalf Gate #1 (PMTiles headers, SHA-256 checksums, non-zero file sizes).
- [x] **QA-002**: Gandalf Gate #2 (`npm run maps:verify` with zero defects).
- [x] **QA-003**: Gandalf Gate #3 (`rm -rf src/data/generated && npm run build:map-data && npm run build`).
- [x] **QA-004**: Gandalf Gate #4 (`npm run scan:synthetic` blocking test fixture leakage).
- [x] **QA-005**: Strict CI Invariant suite (`src/__tests__/ciInvariants.test.ts`).
- [x] **QA-006**: Release gate pipeline (`npm run ci:gate`).
