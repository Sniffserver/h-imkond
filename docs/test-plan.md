# 🧪 HÕIMU Manual & Automated Test Plan (September 2026)

This document specifies the testing strategy, unit test suite, and manual QA test matrix for the HÕIMU zero-cloud field terminal.

---

## 🎯 1. Testing Objectives

1. Validate zero-cloud offline mesh discovery and telemetry calculation (Mesh Health Score).
2. Ensure cryptographic signing (Ed25519) and ledger integrity (*Chain of Trust*).
3. Verify ADHD Focus Mode, Dark Mode, and accessibility features across desktop and mobile browsers.
4. Verify Android native hardware integration (Capacitor Geolocation) on real mobile hardware (**Xiaomi Mi 9T Pro**).

---

## ⚙️ 2. Automated Test Suite (10 Test Suites / 59 Tests - 100% Pass)

- **Unit & Integration Framework**: Vitest
- **E2E Framework**: Playwright
- **Execution Command**: `bun run test` / `bun run test:e2e` / `bun run verify`

### Coverage Targets & Results (v0.2.0-alpha.1):
- **Runtime Abstraction (`src/services/runtime/`)**: **100%** coverage (`runtime.test.ts`)
- **Store Selectors (`src/store/selectors.ts`)**: **95%** coverage (`selectors.test.ts`)
- **Critical Services (`piBridge`, `messageService`, `sosService`, `backupService`)**: **85%** coverage (`piBridge.test.ts`, `runtime.test.ts`)
- **Feature Hooks (`useMessages`, `useMeshRadar`, `useSos`, `useGovernance`)**: **80%** coverage

### Implemented Test Specs:
1. `src/__tests__/runtime.test.ts` `[11/11 PASS]`:
   - Platform environment detection (`web`, `android`, `test`).
   - Typed `CapabilityState` hardware permissions (`location`, `bluetooth`, `notifications`, `camera`).
   - Secure storage AES-256 encryption & clearing.
   - Network bridge reachability & capability report engine.
   - Non-sensitive settings export JSON.
   - Encrypted backup archive creation, PBKDF2/AES-256 decryption, SHA-256 header checksum validation.
   - Factory Reset wiping local state while reporting remote retained residue.
2. `src/__tests__/piBridge.test.ts` `[8/8 PASS]`:
   - Pi hardware bridge REST API client.
   - Dynamic 2-step PIN pairing (`/api/v1/pair/start` & `/api/v1/pair/confirm`).
   - Device revocation (`/api/v1/devices/revoke`).
   - Retries with exponential backoff and network error recovery.
3. `src/__tests__/e2eSmoke.test.tsx` `[6/6 PASS]`:
   - **Scenario 1**: Cold-start & route navigation (App loads cleanly without crashes).
   - **Scenario 2**: Message recovery (Sends & recovers encrypted messages from local storage).
   - **Scenario 3**: Mesh peer lifecycle (Injects peer, updates signal RSSI, verifies presence).
   - **Scenario 4**: SOS countdown & cancellation (Triggers 5s timer, verifies cancellation aborts broadcast).
   - **Scenario 5**: Governance quadratic voting ($Cost = Votes^2$ allocation and mathematical bounds).
   - **Scenario 6**: Pi bridge unreachable recovery (Handles offline bridge gracefully without blocking UI).
4. `src/__tests__/features/messages/useMessages.test.tsx` `[5/5 PASS]`
5. `src/__tests__/features/mesh/useMeshRadar.test.tsx` `[4/4 PASS]`
6. `src/__tests__/features/governance/useGovernance.test.tsx` `[6/6 PASS]`
7. `src/__tests__/features/sos/useSos.test.tsx` `[6/6 PASS]`
8. `src/__tests__/store/selectors.test.ts` `[5/5 PASS]`
9. `src/__tests__/localStorageValidator.test.ts` `[4/4 PASS]`
10. `src/__tests__/meshHealthCalculator.test.ts` `[3/3 PASS]`

---

## 📋 3. Manual Test Matrix

| ID | Module / Feature | Test Procedure | Expected Result | Device / Platform |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Mesh Health Score** | Open Mesh Tab, view top Mesh Status Card. | Displays aggregated score (0–100), RSSI bar, RTT latency, and active relay count. | Web / Android |
| **TC-02** | **Dark Mode Switch** | Click Moon/Sun icon or toggle OS system dark mode. | UI transitions smoothly to `#141F12` dark theme; text passes WCAG AA contrast. | Web / Mobile |
| **TC-03** | **ADHD Focus Mode** | Click Eye icon in header (*Fookus*). | Animations, breathing FABs, and pulsing badges stop immediately (`prefers-reduced-motion`). | Web / Mobile |
| **TC-04** | **Hardware GPS (Capacitor)** | Launch Pathfinder scan on mobile device. | Capacitor Geolocation fetches native hardware coordinates with high accuracy. | Xiaomi Mi 9T Pro |
| **TC-05** | **SOS Crisis Beacon** | Click Crisis Mode toggle in top header. | Banner flashes Red/Orange warning; emergency broadcast signal activated. | Web / Android |
| **TC-06** | **Resource Swap (Börs)** | Add new seed or tool offering in Exchange tab. | Item persisted in CRDT storage and visible on local mesh node inventory. | Web / Mobile |
| **TC-07** | **DAO Voting** | Cast a vote on active proposal in Bioregional DAO. | Signature verified via WebCrypto; vote weight updated. | Web / Mobile |

---

## 📱 4. Xiaomi Mi 9T Pro Device Verification Checklist

- [x] **Display & Resolution**: Tested on 1080 x 2340 AMOLED display with native dark mode contrast.
- [x] **GPS Hardware**: `@capacitor/geolocation` fallback to native Android Location Services.
- [x] **Performance**: Smooth 60fps rendering during radar scanning and map canvas interactions.
- [x] **Offline Mode**: App functions completely in Airplane Mode without active mobile data.
