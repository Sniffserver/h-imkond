# HÕIMU Field Terminal — Threat Model & Security Posture

## Overview

The HÕIMU Field Terminal is designed for resilient communication, mutual aid, and emergency coordination in hostile or infrastructure-deprived environments (off-grid, post-disaster, or civil disruption). Operating over unencrypted RF spectra (LoRa 868/915 MHz, BLE, Wi-Fi Direct), the system assumes **untrusted radio environments and hostile physical conditions**.

---

## Threat Matrix & Security Analysis

### 1. Physical Device Loss or Seizure
- **Threat Vector**: A terminal device (smartphone/tablet) is lost, stolen, or confiscated at a field checkpoint. Adversary attempts to extract private cryptographic keys, peer chat histories, location logs, or community trust lists.
- **Risk Level**: **CRITICAL**
- **Mitigations Implemented in Code**:
  - Sensitive keys (Ed25519) and message state stored in AES-256 encrypted storage (`secureStorage.ts`) protected by device-bound salt and optional operator PIN.
  - One-click **Factory Reset** path in runtime service (`backupService.ts`) instantly purges all local keys, decrypted caches, and IndexedDB stores.
  - Identity backup exports require a password and are protected by PBKDF2 (100,000 iterations) + AES-256. Plaintext secrets are never exported unencrypted.
- **Residual Risk & Field Operator Advice**:
  - Memory extraction via cold-boot attack is possible if device is seized while unlocked. Operators in high-risk sectors should enforce full-disk encryption (Android FDE/FBE) and configure quick lock timers.

---

### 2. Rogue Mesh Nodes & Malicious Packet Injection
- **Threat Vector**: A malicious actor deploys rogue LoRa or BLE nodes to inject forged messages, flood the mesh with spam, trigger false SOS alerts, or alter quadratic governance vote tallies.
- **Risk Level**: **HIGH**
- **Mitigations Implemented in Code**:
  - **Ed25519 Cryptographic Signatures**: All mesh messages, SOS broadcasts, and governance votes are signed with the originator's private key. Unsigned or corrupted packets are dropped upon reception.
  - **Quadratic Vote Cost Validation**: Governance engine (`useGovernance`) enforces mathematical $Cost = Votes^2$ client-side and server-side on the Pi bridge; over-allocated or invalid votes are rejected.
  - **SOS Protocol Gatekeeper**: SOS triggers require explicit operator confirmation (`confirmRequired: true`). Single-node flooding is mitigated by per-sender rate limiting and duplicate packet suppression.
- **Residual Risk & Field Operator Advice**:
  - RF Jamming can disrupt local mesh communications. Physical relay nodes should be dispersed and hidden.

---

### 3. Pi Hardware Bridge Compromise or MitM Attacks
- **Threat Vector**: An adversary gains network or physical access to the Raspberry Pi Zero 2 W Hardware Bridge (`192.168.4.1:8080`) or attempts to intercept REST API traffic between the client app and the bridge.
- **Risk Level**: **HIGH**
- **Mitigations Implemented in Code**:
  - **2-Step PIN Pairing Protocol**: Clients must complete challenge-response PIN pairing (`/api/v1/pair/start` & `/api/v1/pair/confirm`) before receiving a scoped Bearer token.
  - **Revocation Endpoint**: Devices can revoke token access via `/api/v1/devices/revoke`.
  - **End-to-End Encryption (E2EE)**: Direct messaging payloads are encrypted at the client layer before reaching the Pi bridge. The bridge acts strictly as a zero-knowledge store-and-forward relay.
- **Residual Risk & Field Operator Advice**:
  - Physical access to the Pi SD card allows full extraction of bridge logs. Operators should enable LUKS encryption on the Pi OS root filesystem and change default pairing PINs.

---

### 4. RF Location Tracking & Metadata Leakage
- **Threat Vector**: Adversaries use Direction Finding (RDF) equipment or RSSI triangulation to locate operators broadcasting periodic mesh beacons or active SOS distress signals.
- **Risk Level**: **HIGH**
- **Mitigations Implemented in Code**:
  - **Stealth / Passive Mode**: Operators can disable periodic Bluetooth/LoRa beaconing in settings, switching to passive listen-only scanning.
  - **Location Fuzzing**: Option to truncate GPS coordinates to ~1 km grid precision for routine peer discovery.
  - **Explicit SOS Authorization**: GPS location is attached ONLY when an explicit SOS distress sequence is triggered by the user.
- **Residual Risk & Field Operator Advice**:
  - RF transmissions inherently emit radio waves. When operating under direct surveillance, limit transmission bursts or use directional Yagi antennas to minimize RF footprint.

---

### 5. Accidental Data Export Leaks
- **Threat Vector**: An operator exports a system backup for migration and inadvertently leaks unencrypted private keys or raw contact directories via unsecure channels.
- **Risk Level**: **MEDIUM**
- **Mitigations Implemented in Code**:
  - **Separation of Export Paths**: The UI provides a clear distinction between unencrypted settings (`hoimu_settings.json` — zero secrets) and full state archives (`.hoimu-archive` — strictly password encrypted).
  - **Checksum Verification**: Archives contain SHA-256 header checksums (`validateArchiveHeader`) preventing restoration of corrupted or tampered export files.
- **Residual Risk & Field Operator Advice**:
  - Operators must choose strong, high-entropy passwords when creating `.hoimu-archive` files.

---

## Summary Security Checklist for Deployment

- [x] All direct communication payloads encrypted client-side (AES-256 / Ed25519).
- [x] Hardware capability checks isolated in typed `CapabilityState` union (`src/services/runtime/`).
- [x] Pi Bridge REST API protected by 2-step PIN authentication and Bearer token revocation.
- [x] Data backup flows enforce PBKDF2 key derivation and SHA-256 checksum integrity.
- [x] Factory Reset path available to wipe local storage instantly upon risk of compromise.
