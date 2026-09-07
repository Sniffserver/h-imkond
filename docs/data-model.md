# HÕIMU Field Terminal — Data Persistence & State Model

## Overview

The HÕIMU Field Terminal operates on a **zero-cloud, local-first, peer-to-peer mesh architecture**. Data is created and held directly on the local terminal, relaying through local BLE/LoRa physical nodes and Raspberry Pi Zero 2 W hardware bridges.

This document defines the explicit persistence rules, storage location, encryption guarantees, sync conflict resolution, retention lifecycle, and sensitivity classification for every state domain.

---

## State Domains & Persistence Matrix

| State Domain | Primary Storage Location | Encrypted at Rest | Exportable | Retention Period | Deletion Mechanism | Conflict Resolution (Mesh Sync) | Sensitivity Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Identity & Crypto Keys** | Android Secure Storage / Encrypted `localStorage` | **Yes** (AES-256-GCM + PBKDF2) | **Password Protected** (`.hoimu-key`) | Indefinite (User Lifetime) | Manual reset or Key Revocation | Local Authority (Single Source of Truth) | **HIGHLY CRITICAL** (Private Ed25519 Keys) |
| **2. Messages & Comms** | Local Storage / IndexedDB (`hoimu_messages`) | **Yes** (AES-256 Payload Encryption) | **Yes** (JSON Archive) | 30 Days default / Customizable | Expired auto-purge or Manual clear | Last-Write-Wins (Lamport Timestamp + Msg UUID) | **HIGH** (Peer DM Content) |
| **3. Mesh Peer Discovery** | In-Memory (Zustand) + Local Storage (`hoimu_mesh_peers`) | **No** (Public RF Telemetry) | **Yes** (GeoJSON / CSV) | Transient (Stale purge after 15 min inactivity) | Auto-prune on RSSI expiration | Max RSSI + Latest Heard Timestamp Merge | **MEDIUM** (Peer Callsigns, Node IDs, RSSI) |
| **4. SOS Telemetry & History** | Local Storage (`hoimu_sos_history`) + Pi Bridge | **Yes** (Encrypted Location Payload) | **Yes** (CSV / JSON) | Permanent Emergency Ledger | Explicit Operator Acknowledgment / Purge | CRDT Add-Only Log (Priority Overwrite) | **CRITICAL** (GPS Emergency Coordinates) |
| **5. Governance & DAO Votes** | Local Storage (`hoimu_dao_proposals`) + Pi Bridge | **No** (Public Ledger Ledger) | **Yes** (JSON / CSV) | Epoch Lifetime (30 Days active) | Epoch Finalization archive | Quadratic Vote Tally Aggregation ($Cost = Votes^2$) | **MEDIUM** (Vote Allocations, Proposal Texts) |
| **6. Mutual Aid Transactions** | Local Storage (`hoimu_transactions`) | **No** (Public Ledger) | **Yes** (Text Ledger / JSON) | Indefinite | Factory Reset | Bi-directional Multi-sig Confirmation | **LOW** (Completed Barter & Credit Logs) |
| **7. Resource & Skill Listings** | Local Storage (`hoimu_resource_offers`) | **No** (Public Broadcast) | **Yes** (JSON) | 60 Days | Owner Removal or Expiration | Versioned Vector Clock Sync | **LOW** (Offered Supplies & Equipment) |
| **8. Offline Map Tiles & GIS** | IndexedDB / CacheStorage (`hoimu_map_tiles_v1`) | **No** (Public Vector Tiles) | **No** (Cached Binary) | Permanent until cache clear | Manual Region Deletion | Immutable Tile Hash Matching | **LOW** (MBTiles / OpenStreetMap vectors) |
| **9. App Settings & Prefs** | Local Storage (`hoimu_night_mode`, etc.) | **No** | **Yes** (Unencrypted Settings JSON) | Permanent | Factory Reset | Local Terminal Override | **NONE** (UI Dark mode, Glove mode, Sun mode) |

---

## Detailed Domain Specifications

### 1. Identity & Cryptographic Keys
- **Data Held**: Ed25519 Public/Private keypair, device callsign, avatar seed, node UUID.
- **Storage**: Android Secure Preferences (Capacitor) or AES-256 encrypted `localStorage` (`secure_hoimu_aes_key`).
- **Conflict Resolution**: Local device is master authority. Private keys are never overridden or synced over mesh.
- **Sensitive Fields**: Private Ed25519 signing key, raw seed phrases.

### 2. Encrypted Mesh Messaging
- **Data Held**: Direct message packets, sender/recipient public keys, IVs, timestamps, delivery states (`pending`, `delivered`, `failed`).
- **Storage**: IndexedDB & `localStorage` (`hoimu_messages`).
- **Conflict Resolution**: Deduplicated by unique message UUID. Retried using exponential backoff until ACK received.
- **Sensitive Fields**: Message content plaintext, recipient routing targets.

### 3. Mesh Peer Discovery & Radar
- **Data Held**: Discovered BLE/LoRa nodes, RSSI signal strength, hop counts, radio protocol (BLE vs LoRa vs Wi-Fi Direct).
- **Storage**: High-frequency Zustand in-memory state, backed by `hoimu_mesh_peers`.
- **Conflict Resolution**: Merged by `id` or `callsign`. Highest RSSI and most recent `lastHeard` timestamp takes precedence.
- **Sensitive Fields**: Proximity telemetry, node signal mapping.

### 4. SOS Emergency Protocol Telemetry
- **Data Held**: SOS packets, urgency level (`CRITICAL`, `MEDICAL`, `HAZARD`), GPS coordinates, battery %, distress note.
- **Storage**: Local Storage (`hoimu_sos_history`) + Pi Zero 2 W Bridge EEPROM.
- **Conflict Resolution**: CRDT Add-Only Log. SOS packets possess highest priority in transmission queue and cannot be overwritten by standard messages.
- **Sensitive Fields**: Real-time distress GPS location, medical note.

---

## Data Export & Portability

The terminal provides two distinct export paths:

1. **Non-Sensitive Settings Export (`hoimu_settings.json`)**:
   Contains theme preferences, UI scaling choices, bridge IP configurations, and notification schedules. Excludes all credentials and keys.

2. **Password-Protected Encrypted Backup Archive (`.hoimu-archive`)**:
   Contains complete application state (messages, transactions, journal, identities). Encrypted using PBKDF2 (100,000 iterations SHA-256) + AES-256-CBC. Includes format version `1.0.0` and SHA-256 header checksum.

---

## Factory Reset & Recovery Boundaries

When performing a **Factory Reset** from the terminal settings:

1. **Erased Locally**:
   - Device encryption keys (`hoimu_aes_key`, `hoimu_identity`)
   - Local message history, journals, and transaction logs
   - Offline map tile caches and cached peer lists
   - UI settings and local credentials

2. **Retained Remotely (Inert Mesh Network Residue)**:
   - SOS distress packets previously broadcasted over LoRa/BLE
   - Public governance votes already submitted to Pi Zero 2 W Bridge
   - Mutual aid barter confirmations recorded on peer devices
