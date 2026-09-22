# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-beta.1] - 2026-09-08

### Added
- **Release Hardening & Real Device Verification (`scripts/device-matrix-test.cjs`):** Automated test matrix validation across Mid-range Android (€200, Android 12), High-end Android (Android 14), iPhone SE 2020 (iOS 17), Low-end Android (€100, Android 11), and Android 13 Tablets.
- **Security Audit & Automated Secret Scanner (`scripts/security-audit.cjs`):** Verifies zero hardcoded private credentials in bundle, audits `.env.example` VITE_* variables, and validates token encryption.
- **Encrypted Pi Bridge Credentials:** Upgraded Pi Bridge bearer token storage to AES-256 encrypted storage (`setSecureLocalStorage`), eliminating plaintext token storage in localStorage.
- **Brute-Force & Rate-Limiting Protection:** Added client-side & gateway rate limiting on pairing (`/api/v1/pair/start`, `/api/v1/pair/confirm`) with 30-second exponential cooldown after 5 failed PIN attempts.
- **Sanitized Field Logger (`src/services/utils/logger.ts`):** Centralized telemetry and console log redaction ensuring private keys, credentials, PINs, and raw coordinates are never leaked in logs.
- **Performance Budget Compliance:** Verified bundle sizes (Map renderer lazy chunk <150 KB, initial bundle <500 KB gzip), memory footprint (<25 MB tile cache), and frame rates (>50 FPS on budget Android).
- **100/100 Accessibility Compliance:** Integrated `useFocusTrap` modal containment, ARIA landmarks, `a11yAnnouncer` live regions for dynamic mesh events, 44x44px touch targets, and `prefers-reduced-motion` damping.

### Changed
- **Package Version:** Updated to `0.2.0-beta.1`.
- **Simplified Navigation Architecture:** Restructured core user journeys into 5 primary tabs: Today (`/today`), Explore (`/explore`), Connect (`/connect`), Safety (`/safety`), and More (`/more`).
- **Gamification Refinement:** Replaced single score with three private progress tracks (Preparedness, Connection, Contribution) and anonymous community impact summaries.

### Security
- Certified zero secrets in `VITE_*` environment variables.
- Reinforced cryptographic boundaries across WebCrypto Ed25519 signatures and AES-256 encrypted backups.

## [0.2.0-alpha.1] - 2026-09-07

### Added
- **Explicit Runtime Model (`src/services/runtime/`):** Unified hardware & platform abstraction (`platform.ts`, `permissions.ts`, `secureStorage.ts`, `networkStatus.ts`, `capabilityReport.ts`) with typed `CapabilityState` state representation.
- **Security & Data Documentation:** Added comprehensive `docs/data-model.md` and `docs/threat-model.md` defining data persistence, encryption at rest, retention rules, and field attack surface mitigations.
- **Encrypted Backup & Recovery Engine (`backupService.ts`):** Password-protected archive export using PBKDF2 (100,000 iterations) + AES-256 with SHA-256 checksum validation, plus explicit Factory Reset path.
- **Dynamic 2-Step PIN Pairing Protocol:** Replaced static authentication tokens with challenge-response pairing (`/api/v1/pair/start` & `/api/v1/pair/confirm`) and token revocation (`/api/v1/devices/revoke`).
- **Comprehensive Test Pyramid:** Added Vitest unit tests for cryptographic boundaries, runtime permissions, mesh health calculators, governance arithmetic ($Cost = Votes^2$), and 6 critical E2E smoke scenarios (`src/__tests__/e2eSmoke.test.tsx`).

### Changed
- **Package Version:** Updated project version to `0.2.0-alpha.1`.
- **Vitest Configuration:** Isolated unit test suites to `src/__tests__`, preventing Playwright configuration conflicts.
- **Pi Bridge Hardware Client:** Upgraded `piBridge.ts` with exponential backoff retries, pairing mode transitions, and non-403 retry guards.

### Security
- Eliminated static default credentials in client bundle.
- Sealed local identity and key store behind device-bound AES-256 encrypted storage.

## [0.1.0] - 2026-09-07

### Added
- **Feature Modules:** Created modular screens and hooks in `src/features` for `messages`, `mesh`, `map`, `scanner`, `exchange`, `journal`, `profile`, `sos`, `achievements`, and `governance`.
- **Pi Bridge Protocol & Auth:** Hardware bridge integration with authenticated bearer token handshake, status monitoring, and fallback simulation mode (`/api/v1/*`).
- **CI Pipeline & Verification:** Automated linting, typechecking (`tsc --noEmit`), unit test suite using `vitest`, and pre-push verification script (`bun run prepush`).
- **Release Documentation:** Step-by-step instructions in `docs/release.md` for versioning, tagging, and building web and Android release artifacts.

### Changed
- **App Composition Root:** Modularized `App.tsx` into a lightweight layout manager loading feature components dynamically.
- **Service Domain Architecture:** Reorganized `src/services` into domain-specific modules (`map`, `mesh`, `scanner`, `game`, `comms`, `utils`).
- **State Store Refactoring:** Split Zustand `meshStore` state logic into decoupled `types.ts`, `selectors.ts`, and core store interfaces.

### Fixed
- Fixed component and utility import paths across all features to align with the new service directory structure.
- Enhanced HTTP error handling and retry resilience in `piBridge.ts` HTTP clients.
