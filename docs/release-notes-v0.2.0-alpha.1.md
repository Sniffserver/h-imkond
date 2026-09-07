# Release Notes — v0.2.0-alpha.1

**Tag:** `v0.2.0-alpha.1`  
**Target:** Public Alpha Field Deployment Candidate  
**Architecture:** Zero-Cloud Off-Grid P2P Mesh Terminal (Web SPA / Capacitor Android / Pi Hardware Bridge)

---

## Executive Summary

Version `v0.2.0-alpha.1` marks the first public alpha milestone for the **HÕIMU Field Terminal**. This release moves the project from early prototype status to a field-ready, test-backed operational state. It introduces a modular feature architecture, a typed runtime capability abstraction layer, dynamic 2-step PIN pairing for Raspberry Pi Zero 2 W hardware bridges, PBKDF2/AES-256 password-protected backup archives, and an end-to-end test pyramid.

---

## What's New in v0.2.0-alpha.1

### 1. Modular Feature Architecture & Decoupled State
- **Feature Modules (`src/features/`)**: Fully isolated domain modules for `messages`, `mesh`, `map`, `scanner`, `exchange`, `journal`, `profile`, `sos`, `achievements`, and `governance`.
- **Typed Mesh Store & Pure Selectors (`src/store/selectors.ts`)**: Decoupled Zustand state slices with memoized selectors (`selectPeersArray`) for pure RSSI merging, deduplication, and stale peer filtering ($> 15$ minutes inactivity).

### 2. Explicit Runtime Abstraction Model (`src/services/runtime/`)
To eliminate unexpected crashes across Web and Android environments, every hardware capability returns a typed `CapabilityState` union:
```typescript
type CapabilityState =
  | { status: "available" }
  | { status: "permission_denied"; permission: string }
  | { status: "unsupported"; reason: string }
  | { status: "unavailable"; reason: string };
```
- **`platform.ts`**: Environment detection across Web, Android (Capacitor), and Vitest test modes.
- **`permissions.ts`**: Graceful permission probes and requests for Location, Bluetooth LE, Push Notifications, and Camera.
- **`secureStorage.ts`**: Device-bound encrypted storage using Capacitor on Android and salt-bound AES-256 `localStorage` fallbacks.
- **`networkStatus.ts`**: Online/offline tracking with automatic 10s health probes for Pi hardware bridges.
- **`capabilityReport.ts`**: Unified system diagnostics exposed via `getSystemCapabilityReport()` and the `useCapabilityReport()` React hook.

### 3. Versioned Pi Bridge Protocol & Dynamic PIN Pairing
- **Dynamic 2-Step PIN Pairing**: Replaced static client-side tokens with challenge-response pairing (`POST /api/v1/pair/start` & `POST /api/v1/pair/confirm`) and explicit device revocation (`POST /api/v1/devices/revoke`).
- **Resilient Transport**: Exponential backoff retries with network error recovery and non-403 retry guards.
- **Protocol Observability**: Version enforcement ($v1.0.0+$ required) and real-time bridge status reporting.

### 4. Backup, Portability & Factory Reset (`backupService.ts`)
- **Unencrypted Preferences Export**: Clean JSON export of non-sensitive UI settings (`hoimu_settings.json`).
- **Password-Protected Archive**: Full encrypted state export using PBKDF2 (100,000 iterations SHA-256) + AES-256-CBC with SHA-256 header checksum validation.
- **Factory Reset**: Instant one-click wipe of local encryption keys and data stores with clear feedback on local vs. remote retained state.

### 5. Data & Threat Model Documentation
- **`docs/data-model.md`**: Complete persistence matrix detailing location, encryption at rest, retention, exportability, and CRDT/LWW conflict resolution across all 9 state domains.
- **`docs/threat-model.md`**: In-depth threat analysis addressing physical device seizure, rogue RF nodes, Pi bridge MitM, location tracking, and data leaks.

---

## Alpha Entry Criteria & Verification Matrix

All entry criteria for `v0.2.0-alpha.1` have been verified green locally and in CI:

| Criterion | Command | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Linter** | `bun run lint` | ✅ PASSED | 0 ESLint warnings or errors |
| **Type Check** | `bun run typecheck` | ✅ PASSED | Strict TypeScript compilation clean |
| **Unit Tests** | `bun run test` | ✅ PASSED | 10 suites / 59 unit tests passed |
| **Production Build** | `bun run build` | ✅ PASSED | Vite bundle generated without errors |
| **E2E Smoke Suite** | `bun run test:e2e` | ✅ PASSED | 6 critical flow smoke scenarios verified |
| **Pi Hardware Test** | `bun run test:pi` | ⚠️ DEMO / MOCK | Tested against local bridge mock server. Physical Pi hardware smoke test documented in `docs/release.md`. |

---

## Manual Android Verification Checklist (For Named Alpha Testers)

Field testers installing the Android APK (`app-release-unsigned.apk` / `app-debug.apk`) should verify the following 7 manual scenarios on physical hardware:

1. **Fresh Installation**: App boots cleanly into the Onboarding flow without unhandled exceptions or blank screens.
2. **Permission Denied Paths**: Denying Location or Bluetooth permissions renders the typed permission banner instead of crashing.
3. **Offline Cold Startup**: Booting with Wi-Fi/Cellular toggled off loads cached map tiles and local data seamlessly.
4. **Background / Foreground Transitions**: Switching apps and returning preserves active UI state, ongoing messages, and radar state.
5. **App Restart Data Restoration**: Force-closing and re-opening the app successfully reloads encrypted messages and profile settings from secure storage.
6. **Pi Bridge Unavailable & Restored**: Turning off the Pi bridge triggers "Bridge Unreachable" status gracefully; powering the Pi back on auto-reconnects within 10 seconds.
7. **SOS Test Mode Confirmation/Cancellation**: Toggling SOS triggers the 5-second countdown with visual/audio alert; clicking "Cancel SOS" safely aborts transmission before broadcast.

---

## Known Limitations (v0.2.0-alpha.1)

1. **Physical Hardware Bridge Requirement**: Full off-grid LoRa relaying requires a paired Raspberry Pi Zero 2 W running the HÕIMU Bridge Daemon (`v1.0.0+`). Without a Pi bridge, the terminal operates in local Bluetooth LE or offline simulation mode.
2. **Offline Map Tile Bounds**: Offline map storage is limited by local browser/device storage quotas (typically ~500 MB to 2 GB). Vector tile downloads must be scoped to specific regional bounding boxes.
3. **Physical RF Tracking Risk**: RF transmissions inherently emit detectable signals. In hostile environments, operators should use passive scan mode or location fuzzing.

---

## Migration & State Reset Notice

> [!WARNING]
> **Schema Breaking Change**: Due to the refactoring of storage keys into the new `secureStorage.ts` layer and encrypted state models, pre-alpha client state from `v0.1.0` is incompatible.
> 
> **Action Required**: Users upgrading from `v0.1.0` should perform a **Factory Reset** in Settings or clear browser `localStorage` / application data before starting `v0.2.0-alpha.1`.

---

## Distribution & Build Artifacts

- **Android APK**: Distributed exclusively to named alpha testers via secure side-loading or GitHub Release assets (`hoimu-terminal-v0.2.0-alpha.1.apk`).
- **Web SPA**: Available for preview at the deployed release URL.
