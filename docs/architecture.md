# 🏗️ HÕIMU System Architecture & Design Specification

> **HÕIMU** (*Estonian for "Tribe" / "Kinship"*) is a zero-cloud, privacy-first, offline mutual aid field terminal built for resilient local communities, permaculture hubs, and eco-villages.

---

## 📐 1. System Overview

HÕIMU operates on a **peer-to-peer (P2P), client-authoritative, zero-cloud architecture**. The system is engineered to function continuously during internet outages, grid collapse, or isolated field scenarios using local RF signals (BLE 5.0+, Wi-Fi Direct, LoRa 868MHz/433MHz).

```
   ┌─────────────────────────────────────────────────────────┐
   │                HÕIMU Field Terminal UI                   │
   │      (React 19, Tailwind CSS, Motion, Space Grotesk)     │
   └──────────────────────────┬──────────────────────────────┘
                              │
   ┌──────────────────────────┴──────────────────────────────┐
   │               P2P State & CRDT Ledger                    │
   │  (Conflict-Free Replicated Data Types & LocalStorage)   │
   └──────────────────────────┬──────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  WebCrypto   │       │  Pathfinder  │       │  Capacitor   │
│ Cryptography │       │  RF Scanner  │       │ Native GPS   │
│  (Ed25519)   │       │ (BLE & LoRa) │       │   Hardware   │
└──────────────┘       └──────────────┘       └──────────────┘
```

---

## 📡 2. Mesh Networking & Peer Discovery

### Protocol Layers
1. **Physical / Link Layer**:
   - **Bluetooth Low Energy (BLE 5.0+)**: Discovery of nearby active nodes using custom service UUID beacons.
   - **Wi-Fi Direct / Local Hotspot**: Peer-to-peer bulk file/media transfer (PDF manuals, high-res field maps).
   - **LoRa (Long Range RF)**: Store-and-forward packet transmission over 868MHz (EU) / 433MHz emergency channels.

2. **Network & Routing**:
   - **Hop Distance Tracking**: Nodes monitor TTL (Time To Live) and hop distance (Direct = 1 hop, Relayed = 2+ hops).
   - **Deduplication**: Message Hashes (`SHA-256`) prevent re-broadcasting identical packets.

3. **Mesh Health Score Calculation**:
   Calculated dynamically in `src/utils/meshHealthCalculator.ts`:
   $$\text{Overall Score} = (0.35 \times \text{RSSI Score}) + (0.35 \times \text{Latency Score}) + (0.30 \times \text{Relay Score})$$

---

## 🔐 3. Security, Cryptography & Privacy

- **Zero Central Server**: Identity is generated client-side using WebCrypto API.
- **Keypair Generation**: `Ed25519` keypair generated per terminal instance.
- **Signed Transactions**: All resource swaps, DAO votes, and trust endorsements are signed with the node's private key.
- **Data Integrity**: Cryptographic `SHA-256` hashing verifies transaction authenticity in the *Chain of Trust* (*Usaldusväärsuse Ahel*).

---

## 📱 4. Mobile Native Integration (Capacitor)

HÕIMU is built as a Progressive Web App (PWA) and wrapped with **Capacitor** for native Android APK compilation:
- **`@capacitor/geolocation`**: Directly accesses hardware GPS on mobile devices (e.g., Xiaomi Mi 9T Pro).
- **Background Beaconing**: Works in offline field conditions without cellular data or SIM cards.

---

## 📊 5. Persistence & Storage Reliability

- **Safe LocalStorage Layer (`src/utils/localStorageValidator.ts`)**:
  All cached state is passed through schema validation and `try-catch` JSON deserialization to eliminate state corruption.
- **CRDT Sync**:
  Local changes produce deterministic log operations that automatically merge upon peer contact.
