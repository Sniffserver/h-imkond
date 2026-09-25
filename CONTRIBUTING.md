# Contributing to HÕIMU

Thank you for helping build resilient, zero-cloud mutual aid technology!

## 🏛️ Core Architecture Principle

> **One concept, one truth, one owner.**

- **UI may present a concept in many ways, but the domain model has one canonical representation.**
- **Simulation may imitate production, but never shares production truth.**
- **Compatibility belongs at boundaries.**
- **A guarantee must have an automated invariant.**

### Automated Invariant Examples:
- **"Identity persists"** → reboot / persistence test
- **"Packet is authenticated"** → signature verification test
- **"Map is offline"** → network disabled Playwright / offline bundle test
- **"Outbox survives restart"** → persistent outbox queue test
- **"Radio respects airtime"** → airtime duty-cycle / unit tests
- **"Peer is trusted"** → trust-state invariant test

---

## 🌿 General Guidelines

1. **Zero-Cloud First:** Features must never depend on mandatory external cloud services, phone numbers, or proprietary tracking APIs.
2. **Offline Resilience:** All features must function gracefully when disconnected from the internet.
3. **Accessibility & Energy Efficiency:** Ensure minimal DOM overhead and dark/solar-aware theme support.

## 🛠️ Pull Request Process

1. Fork the repository and create your feature branch (`git checkout -b refactor/hoimu-convergence`).
2. Run tests and verify build compilation:
   ```bash
   npm run lint
   npm run build
   ```
3. Submit a pull request with a clear description of the bioregional use case.
