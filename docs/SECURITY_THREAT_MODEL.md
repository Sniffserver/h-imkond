# HÕIMU Security Architecture & Threat Model

This document outlines the security architecture, threat model, cryptographic invariants, and attack mitigation strategies for the HÕIMU offline mesh network, web application, and hardware bridge (Pi / ESP32).

---

## 1. Threat Model & Attacker Profiles

```
Attacker
 ├── Malicious peer (Injected or rogue node in LoRa/BLE mesh)
 ├── Compromised Pi (Hardware gateway under physical/remote control)
 ├── Replay attacks (Eavesdropped RF packets re-transmitted later)
 ├── Packet injection (Forged frames broadcast over radio spectrum)
 ├── MITM during pairing (Eavesdropping on BLE / Wi-Fi Direct dynamic pairing)
 ├── Stolen device (Physical theft of phone or node with stored credentials)
 ├── XSS in browser (Malicious scripts in web application context)
 └── Corrupted storage (Local database or disk manipulation)
```

---

## 2. Threat Analysis & Mitigations Matrix

| Threat / Attacker Vector | Impact | Defense & Cryptographic Invariant |
| :--- | :--- | :--- |
| **Malicious Peer** | Injects fake CRDT events or routes spam | **Signed Event Log**: All CRDT mutations require Ed25519 signatures. Peer public keys are bound to cryptographic node IDs. Unsigned or invalid signature events are silently dropped. |
| **Compromised Pi** | Tries to issue unauthorized gateway RPC commands | **Scoped Capability Tokens**: JWT/HMAC bearer tokens contain strict capability scopes (`read`, `send`, `relay`, `config`, `reboot`). Higher-risk RPCs (`reboot`, `config`) require `admin` capability. |
| **Replay Attacks** | Re-transmits old RF packets (e.g. old SOS or trade) | **Nonce & Deduplication Protection**: Every packet contains a 32-bit sequence, timestamp, and unique `packetId`. `SeenPacketCache` rejects duplicate packet IDs and out-of-window timestamps. |
| **Packet Injection** | Sends corrupt or malformed radio frames | **Framing & CRC32 Validation**: Every frame carries a 32-bit CRC. Corrupt frames fail binary codec validation prior to application layer processing. Expiration (`expiresAt`) enforces strict TTL bounds. |
| **MITM during Pairing** | Intercepts session key during initial setup | **QR/PIN Ephemeral Pairing**: Session uses cryptographically random 6-digit PIN and short-lived session ID (5 min TTL). Token generation binds client identity and Ed25519 public key. |
| **Stolen Device** | Extracting identity master keys from disk | **Non-Extractable SubtleCrypto**: Cryptographic identity keypairs are stored as non-extractable WebCrypto handles or inside encrypted secret stores (`SecureSecretsStore`). |
| **XSS in Browser** | Reading local browser state or tokens | **Content Security Policy & LocalStorage Validation**: All localStorage inputs are validated with fallback schemas (`LocalStorageValidator`). No `eval()` or inline scripts allowed. |
| **Corrupted Storage** | Tampering with IndexedDB or SQLite database | **Signed Log Verification**: On app startup, stored CRDT events and outbox items are re-verified against author signatures and Lamport clocks. Corrupt entries are purged. |

---

## 3. Entity-Specific CRDT Conflict Policies

To prevent state divergence or malicious manipulation, entity types use domain-specific CRDT merge rules:

| Entity Type | Conflict Policy | Merge Mechanics |
| :--- | :--- | :--- |
| **`resource`** | Last-Write-Wins (LWW) + Signed Author | Higher Lamport clock wins; author signature verified. |
| **`inventory`** | Operation-Based Delta CRDT | Quantity mutations use signed `{ delta }` ops ($+n / -n$). Edits accumulate without overwriting concurrent updates. |
| **`message`** | Immutable Event Log | Append-only. Duplicate `opId`s suppressed; no in-place mutation. |
| **`peer`** | LWW + Signed Author | Key rotations and callsign updates require proof of private key ownership. |
| **`skill`** | LWW + Signed Author | Endorsement levels update via author-signed LWW. |
| **`transaction`** | Immutable Event / Balance Delta | Financial or mutual-aid transfers are append-only signed receipts. |
| **`SOS`** | Immutable Origin + State Machine | SOS origin (location, emergency type) is immutable. State transitions strictly follow: $\text{active} \rightarrow \text{acknowledged} \rightarrow \text{resolved}$. Backwards state changes are rejected. |
| **`map_marker`** | LWW + Signed Author / Tombstone | Edits update via author LWW. Deletions create explicit tombstones. |

---

## 4. Pairing & Capability Lifecycle

$$\text{QR / PIN} \longrightarrow \text{Ephemeral Session (5m)} \longrightarrow \text{Device Identity Check} \longrightarrow \text{Trust Confirmation} \longrightarrow \text{Scoped Capability Token} \longrightarrow \text{Store Peer}$$

1. **Ephemeral Session**: Generated via `POST /api/v1/pair/start`. Session ID and 6-digit PIN expire in 300s.
2. **Device Identity**: Device submits `nodeId`, `callsign`, and `ed25519PublicKeyHex`.
3. **Capability Token**: Pi issues HMAC/Ed25519 capability token binding `sub` (client ID), `pubKey`, `role`, and explicit `caps`.
4. **No Anonymous Magic Tokens**: All API endpoints enforce token capability verification against the stored peer directory (`/var/lib/hoimu/paired_devices.json`).
