# MapPack & Offline Vector Map Architecture

## Features
- **Format**: Single-file `.pmtiles` vector map packs.
- **Verification**: SHA-256 hash verified before activation.
- **Atomic Switching**: Staging buffer -> verify SHA-256 -> atomic switch to active.
- **Explicit States**: `ONLINE`, `ONLINE_DEGRADED`, `OFFLINE_WITH_PACK`, `OFFLINE_NO_PACK`, `MAP_LOADING`, `MAP_ERROR`.
