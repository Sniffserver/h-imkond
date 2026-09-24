# HÕIMU System Overview Architecture

## Architecture Freeze & Boundaries

HÕIMU (HÕIMKOND) is a zero-infrastructure, local-first tactical emergency mesh communication and biosecurity mutual aid system.

```
                      HÕIMKOND CORE
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
   Identity             Protocol              Storage
       │                    │                    │
       └────────────── Mesh Transport ───────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                   Pi             ESP32
                    │               │
                    └───── LoRa ────┘

                            +
                     MapPack / Geo
                            +
                       Field UI
```

## Architectural Layers & Responsibilities

1. **core**: Core domain identities, cryptographic key generation, trust management.
2. **protocol**: Canonical wire binary packet framing, codec, checksums, and golden test vectors.
3. **identity**: Cross-platform `IdentityProvider`, hardware Keystore/StrongBox capability checks, peer trust states.
4. **storage**: Local-first canonical persistence, IndexedDB, outbox queue, and event logs.
5. **mesh**: Bounded flooding mesh router, deduplication cache, ACK lifecycle, store-and-forward outbox.
6. **hardware**: Pi Gateway daemon (`pi/`), ESP32 firmware (`firmware/`), and BLE/LoRa transport adapters.
7. **map**: Offline vector map pack manager (`.pmtiles`), SHA-256 verification, and offline routing.
8. **ui**: Tactical field interface, Day/Night/Red theme rendering, accessibility, and offline badges.
9. **observability**: Telemetry logger, device lab benchmarks, and circular diagnostic buffers.

No new features are permitted outside these 8 canonical subsystems.
