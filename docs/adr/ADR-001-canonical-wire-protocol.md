# ADR-001: Canonical Wire Protocol Standard

## Status
Accepted

## Context
Multiple runtimes (TypeScript WebApp, Python Pi Daemon, C++ ESP32 Firmware) must exchange binary frames across LoRa (868 MHz) and BLE links with zero byte layout mismatch.

## Decision
Adopt the 39-byte fixed header + payload + 64-byte Ed25519 signature + 4-byte CRC32 canonical packet layout across all runtimes.

## Consequences
Guarantees 100% binary cross-compatibility and single-source test vectors across Web, Pi, and ESP32.
