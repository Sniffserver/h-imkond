# HÕIMU Development Constitution & Contributing Guidelines

Welcome to HÕIMU. HÕIMU is an offline-first, bioregional tactical mapping, mesh communication, and spatial discovery network designed to operate under zero-connectivity field conditions.

---

## 🧙 The 10 Gandalf Laws for HÕIMU

These 10 inviolable laws govern all software development, spatial ingestion, offline packaging, and UI design within the HÕIMU codebase:

### 1. One fact, one owner
A street, place, node, or coordinate does not exist in five coordinate systems or duplicate state structures. `GeoPoint` (`{ lat, lng }`) is the single canonical spatial representation.

### 2. A source name is not proof
`source: 'ppa'` or `provenanceStatus: 'official'` is meaningless without an actual, verifiable source record and ID from the authoritative data provider.

### 3. A valid file isn't necessarily useful data
A 900-byte valid PMTiles header or empty index file is still an empty map. `maps:verify` must assert real feature counts, bounding box spatial intersections, and non-empty record tables.

### 4. No silent fallback
The UI and data layers must never silently downgrade or disguise simulated fixture data or stale snapshots as live authoritative truth. An offline fallback MUST explicitly display `SNAPSHOT`, never `LIVE`.

### 5. No dead architecture
When `ExploreMap` replaces legacy map renderers, delete or isolate the legacy code path into diagnostics. Do not maintain parallel, dead map engines in production user flows.

### 6. Every live object needs an update path
If mesh peers, community resources, or GPS fixes update, the map overlays must react and re-render dynamically in real time without requiring a manual page refresh.

### 7. Every offline promise must survive airplane mode
Features designed for offline survival must be tested with zero network interfaces active. An offline feature must work continuously offline, not merely load once from an online network cache.

### 8. Never trust a green CI badge blindly
A passing test must mathematically and structurally prove the claimed invariant. Weak assertions (`expect(true).toBe(true)`) are strictly forbidden.

### 9. The city is the game
Real streets, real hardware shops, real public water points, and physical observations are the game. No synthetic XP or gamified points are required or permitted.

### 10. Make the impossible obvious
When a map pack is corrupt, display **`MAP PACK CORRUPT`**. When GPS is unavailable, display **`NO LIVE LOCATION`**. When POI data is stale, display **`DATA 31 DAYS OLD`**. Never render a beautifully styled lie.

---

## Release Invariants & Verification Commands

Before submitting any code changes, verify your branch using the complete release gate:

```bash
npm run typecheck
npm run lint
npm run maps:check
npm test
npm run build
```
