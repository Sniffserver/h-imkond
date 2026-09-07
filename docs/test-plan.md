# 🧪 HÕIMU Manual & Automated Test Plan (September 2026)

This document specifies the testing strategy, unit test suite, and manual QA test matrix for the HÕIMU zero-cloud field terminal.

---

## 🎯 1. Testing Objectives

1. Validate zero-cloud offline mesh discovery and telemetry calculation (Mesh Health Score).
2. Ensure cryptographic signing (Ed25519) and ledger integrity (*Chain of Trust*).
3. Verify ADHD Focus Mode, Dark Mode, and accessibility features across desktop and mobile browsers.
4. Verify Android native hardware integration (Capacitor Geolocation) on real mobile hardware (**Xiaomi Mi 9T Pro**).

---

## ⚙️ 2. Automated Test Suite

- **Unit Testing Framework**: Vitest
- **Execution Command**: `npm run test` or `npx vitest run`

### Implemented Unit Test Specs:
- `src/__tests__/meshHealthCalculator.test.ts`:
  - `[PASS]` Default offline state when peer list is empty.
  - `[PASS]` High score calculation for strong direct and relayed peers.
  - `[PASS]` Degraded health calculation for weak signal RSSI ($-95\text{ dBm}$).
- `src/__tests__/localStorageValidator.test.ts`:
  - `[PASS]` Fallback handling when localStorage key does not exist.
  - `[PASS]` Parsing valid JSON objects from localStorage.
  - `[PASS]` Graceful recovery when localStorage contains corrupted/malformed JSON.
  - `[PASS]` Runtime schema validator function execution.

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
