# HÕIMU Map Data Truth Matrix & Status Roadmap

> **Core Axiom**: *Do not decorate the bridge before verifying it crosses the river.*  
> Real data $\rightarrow$ Real map $\rightarrow$ Real routing $\rightarrow$ Real discovery $\rightarrow$ Real mesh observations $\rightarrow$ Then beautification.

---

## 1. Status Legend

- **✅ verified in production**: Feature fully built, integrated into active runtime, verified by automated unit/integration tests and CI gates.
- **🟡 implemented but not validated on real data/device**: Architecture and adapters implemented, but pending full live hardware device or production-scale city dataset validation.
- **🔴 planned**: Specified in architecture, pending implementation.

---

## 2. Data Truth Matrix

| Layer / Feature | Canonical Source | Freshness Model | Offline Mode | Authority Tier | Status | Verification Guarantee |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **Roads & Streets** | OpenStreetMap + Tallinn Geoportal | Static Snapshot / Map Pack | ✅ | **Mixed** (Gov + OpenStreetMap) | **✅** | Topology verified by `maps:verify` |
| **Official Addresses** | Maa-amet ADS Register | Monthly / Live Extract | ✅ | **Official** (State Register) | **🟡** | ADS ID cross-referenced |
| **Civil Shelters** | Päästeamet Civil Protection | Release Snapshot | ✅ | **Official** (Päästeamet) | **🟡** | State rescue department ID |
| **Commercial POIs & Shops**| OpenStreetMap Vector Ingestion | Periodic Snapshot | ✅ | **Community** (ODbL) | **🟡** | OSM Node/Way tag validation |
| **Mutual Aid & Tool Libraries** | HÕIMU Community Ledger | Live CRDT / Local DB | ✅ | **Observed** (Signed Peer Posts) | **✅** | Ed25519 author signature |
| **Mesh Network Topology** | Live RF Radio Packets (LoRa/BLE) | Real-time Heartbeats | ✅ | **Measured** (Hardware Fixes) | **🟡** | Physical RSSI/SNR signal trail |
| **LoRa Radio Coverage** | Bioregional RF Propagation Model | Dynamic Calculation | ✅ | **Estimated** (Modelled) | **✅** | Explicitly labeled as estimated |

---

## 3. Provenance UI Archetypes

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

## 4. HÕIMU Feature & Data Roadmap

### Phase 0 — Truth Lock (Zero Synthetic Invariants)
- [x] **GEO-001**: Canonical `GeoPoint` (`{ lat, lng }`) across all domains — **✅ verified in production**
- [x] **GEO-002**: Canonical `GeoFix` with accuracy, speed, altitude, and timestamp — **✅ verified in production**
- [x] **GEO-003**: Remove latitude/longitude aliases and planar projections in domain state — **✅ verified in production**
- [x] **GEO-004**: Purge canvas $x/y$ coordinates from storage and POI domain models — **✅ verified in production**
- [x] **GEO-005**: Consolidate `SurvivalPoi` into canonical `MapPlace` — **✅ verified in production**
- [x] **DATA-001**: Strict fixture isolation (`src/data/fixtures/**` forbidden in production imports) — **✅ verified in production**
- [x] **DATA-002**: Multi-source provenance model (`sources[]` and `conflicts[]`) — **✅ verified in production**
- [x] **DATA-003**: Ban unverified "official" claims — **✅ verified in production**

### Phase 1 — Real Tallinn Data Pipeline
- [x] **DATA-010**: OSM vector extraction adapter — **🟡 implemented but not validated on real data/device**
- [x] **DATA-011**: Tallinn Open Data API integration adapter — **🟡 implemented but not validated on real data/device**
- [x] **DATA-012**: Tallinn Geoportal spatial ingestion adapter — **🟡 implemented but not validated on real data/device**
- [x] **DATA-013**: Maa-amet ADS Estonian official address ingestion — **🟡 implemented but not validated on real data/device**
- [x] **DATA-014**: Päästeamet public shelters register adapter — **🟡 implemented but not validated on real data/device**
- [x] **DATA-015**: Heterogeneous source normalization — **✅ verified in production**
- [x] **DATA-016**: Spatial deduplication & coordinate clustering ($< 35\text{m}$) — **✅ verified in production**
- [x] **DATA-017**: General conflict detection (`sources_disagree` badge) — **✅ verified in production**
- [x] **DATA-018**: License and attribution metadata tracking — **✅ verified in production**

### Phase 2 — Real Map Pack Generation & Atomic Installation
- [x] **PACK-001**: Single-file PMTiles basemap (`tallinn-basemap.pmtiles`) — **🟡 implemented but not validated on real data/device**
- [x] **PACK-002**: Tallinn POI vector PMTiles (`tallinn-poi.pmtiles`) — **🟡 implemented but not validated on real data/device**
- [x] **PACK-003**: Compact binary street index (`street-index.bin`) — **✅ verified in production**
- [x] **PACK-004**: Offline search index (`PlaceSearchIndex`) — **✅ verified in production**
- [x] **PACK-005**: Pedestrian routing topology graph (`routing.graph`) — **✅ verified in production**
- [x] **PACK-006**: Generated cryptographic manifest (`manifest.json`) — **✅ verified in production**
- [x] **PACK-007**: SHA-256 checksum generation for all artifacts — **✅ verified in production**
- [x] **PACK-008**: Map pack verification script (`npm run maps:verify`) — **✅ verified in production**
- [x] **PACK-009**: Atomic generation installer (`MapPackInstaller.ts`) — **✅ verified in production**
- [x] **PACK-010**: High-performance OPFS & Capacitor Native Storage — **✅ verified in production**

### Phase 3 — Single MapLibre Vector Engine
- [x] **MAP-001**: Canonical `ExploreMap.tsx` renderer — **✅ verified in production**
- [x] **MAP-002**: Native PMTiles protocol integration — **✅ verified in production**
- [x] **MAP-003**: Hardware-accelerated roads, buildings, water, and park vector layers — **✅ verified in production**
- [x] **MAP-004**: Dynamic GeoJSON user and GPS position overlay — **✅ verified in production**
- [x] **MAP-005**: Canonical `MapPlace` POI vector layer — **✅ verified in production**
- [x] **MAP-006**: Dynamic mesh peer overlay — **🟡 implemented but not validated on real data/device**
- [x] **MAP-007**: Community resource overlay — **🟡 implemented but not validated on real data/device**
- [x] **MAP-008**: Offline A* walking route vector layer — **✅ verified in production**
- [x] **MAP-009**: Segment-based street discovery layer — **✅ verified in production**
- [x] **MAP-010**: Hardware radio Signal Trail layer — **🟡 implemented but not validated on real data/device**

### Phase 4 — Street Explorer & Spatial Discovery
- [x] **STREET-001**: Tallinn street segments across 10 districts — **🟡 implemented but not validated on real data/device**
- [x] **STREET-002**: Sub-segmentation with individual discovery states — **✅ verified in production**
- [x] **STREET-003**: Lightweight $O(1)$ spatial grid hash index (`SpatialSegmentIndex`) — **✅ verified in production**
- [x] **STREET-004**: Trace evidence validation (accuracy $\le 35\text{m}$, movement $\ge 15\text{m}$, 2+ consecutive points) — **✅ verified in production**
- [x] **STREET-005**: Trace confidence rating (`low`, `medium`, `high`) based on GPS quality — **✅ verified in production**
- [x] **STREET-006**: Length-weighted exploration calculations — **✅ verified in production**
- [x] **STREET-007**: Fast street name and district search — **✅ verified in production**
- [x] **STREET-008**: District-level exploration intelligence (`NeighborhoodIntelligenceService`) — **✅ verified in production**

### Phase 5 — Offline Pedestrian Routing
- [x] **ROUTE-001**: A* graph over walkable Tallinn paths — **✅ verified in production**
- [x] **ROUTE-002**: Nearest graph node snapping — **✅ verified in production**
- [x] **ROUTE-003**: Bidirectional A* heuristic traversal — **✅ verified in production**
- [x] **ROUTE-004**: Route GeoJSON linestring generation with turn-by-turn guidance — **✅ verified in production**
- [x] **ROUTE-005**: Responsive route overlay with elevation & walking time estimates — **✅ verified in production**
- [x] **ROUTE-006**: 100% offline routing execution with zero network roundtrips — **✅ verified in production**

### Phase 6 — Universal POI Taxonomy & Deterministic Search
- [x] **PLACE-001**: Unified `MapPlace` canonical model — **✅ verified in production**
- [x] **PLACE-002**: 11-category universal taxonomy (`Safety`, `Tools`, `Stores`, `Food`, `Health`, `Mobility`, `Nature`, `Water`, `Community`, `Finds`, `HÕIMU`) — **✅ verified in production**
- [x] **PLACE-003**: Estonian colloquial aliases (`riistapood`, `uuskasutus`, `varjend`, `allikas`) — **✅ verified in production**
- [x] **PLACE-004**: Offline Inverted Token & Prefix index (`PlaceSearchIndex`) — **✅ verified in production**
- [x] **PLACE-005**: Deterministic ranking without synthetic relevance numbers — **✅ verified in production**
- [x] **PLACE-006**: Data provenance cards with full source breakdown and conflict detection — **✅ verified in production**
- [x] **PLACE-007**: "What Have I Not Seen?" / Unknown Nearby exploration loop — **✅ verified in production**

### Phase 7 — Unified Location Stream & Hardware Abstraction
- [x] **LOCATION-001**: Unified `LocationManager` & `LocationContext` single-stream authority — **✅ verified in production**
- [x] **LOCATION-002**: Multi-source provider selection (`Browser`, `Android`, `GNSSSerial`, `MeshTriangulation`, `Replay`) — **✅ verified in production**
- [x] **LOCATION-003**: Universal `ObservationManager` signal trail ring buffer — **🟡 implemented but not validated on real data/device**

### Phase 8 — HÕIMU Field Loop & Quests
- [x] **FIELD-001**: What Have I Not Seen? (`UnknownNearbySheet.tsx`) — **✅ verified in production**
- [x] **FIELD-002**: Neighborhood Intelligence (`NeighborhoodIntelligenceSheet.tsx`) — **✅ verified in production**
- [x] **FIELD-003**: Authentic Field Quests with real physical objectives (`FieldQuestSheet.tsx`) — **✅ verified in production**
- [x] **FIELD-004**: Physical device location provider selector (`LocationProviderSelector.tsx`) — **✅ verified in production**

### Phase 9 — CI Gates & Invariant Enforcement
- [x] **QA-001**: Gandalf Gate #1 (PMTiles headers, SHA-256 checksums, non-zero file sizes) — **✅ verified in production**
- [x] **QA-002**: Gandalf Gate #2 (`npm run maps:verify` with zero defects) — **✅ verified in production**
- [x] **QA-003**: Gandalf Gate #3 (`rm -rf src/data/generated && npm run build:map-data && npm run build`) — **✅ verified in production**
- [x] **QA-004**: Gandalf Gate #4 (`npm run scan:synthetic` blocking test fixture leakage) — **✅ verified in production**
- [x] **QA-005**: Strict CI Invariant suite (`src/__tests__/ciInvariants.test.ts`) — **✅ verified in production**
- [x] **QA-006**: Release gate pipeline (`npm run ci:gate`) — **✅ verified in production**
