# ESP32 Firmware Architecture

## Subsystems
- **PlatformIO**: C++ firmware targeting Heltec v3 / ESP32-S3 with SX1262 LoRa module.
- **Canonical Codec**: Shared C++ implementation of 39-byte header + Ed25519 signature + CRC32 framing.
- **Low Power & NVS**: Hardware NVS key storage and battery management.
