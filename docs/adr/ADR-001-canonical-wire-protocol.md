# ADR-001: Canonical Binary Wire Protocol Standard (PROTOCOL-001..005)

## Status
Accepted & Enforced

## Context
Multiple runtimes (TypeScript Web/Android App, Python Pi Gateway, C++ ESP32 Firmware) exchange binary frames across LoRa (SX1262 868 MHz) and BLE links. Signature verification and physical framing must be strictly binary-first, deterministic, and free of JSON serialization artifacts at the radio layer.

## Decision
Adopt a strict binary frame standard:
1. **Fixed Header (53 bytes)**:
   - `[0..3]` Magic `0x484F494D` ("HOIM", 4B uint32 BE)
   - `[4]` Version `0x01` (1B uint8)
   - `[5]` Type (1B uint8: MESSAGE=1, DIRECT_ENCRYPTED=2, SOS=3, CRDT_SYNC=4, ROUTE_ANNOUNCE=5, ACK=6)
   - `[6]` Flags (1B uint8: `0x01`=IS_SIGNED, `0x02`=IS_ENCRYPTED, `0x04`=IS_PRIORITY, `0x08`=ACK_REQUESTED, `0x10`=COMPRESSED)
   - `[7]` TTL (1B uint8, default 7, max 15)
   - `[8]` Hop Count (1B uint8)
   - `[9..12]` Sequence (4B uint32 BE, persistent epoch-seeded counter)
   - `[13..20]` Origin ID (8B UTF-8 ASCII node fingerprint)
   - `[21..28]` Destination ID (8B UTF-8 ASCII node identifier, `*` for broadcast)
   - `[29..44]` Packet ID (16B binary UUID/hash or ASCII)
   - `[45..48]` CreatedAtEpochSec (4B uint32 BE Unix timestamp in seconds)
   - `[49..50]` LifetimeSec (2B uint16 BE packet lifetime; `expiresAt = createdAt + lifetime`)
   - `[51..52]` PayloadLength $N$ (2B uint16 BE application payload byte count)
2. **Application Payload ($N$ bytes)**: Pure encrypted bytes or compact serialized JSON without frame wrappers.
3. **Binary Signature (64 raw bytes)**: Appended after payload ONLY if `flags & 0x01` (IS_SIGNED) is set. Preimage = Header (with masked `ttl=0`, `hopCount=0`) + Payload.
4. **CRC32 (4 bytes uint32 BE)**: IEEE 802.3 checksum over Header + Payload + Signature.

## Consequences
- Guaranteed cross-runtime interoperability across Web (TS), Raspberry Pi (Python), and ESP32 (C++).
- Maximum physical MTU = 255 bytes (SX1262 LoRa).
- Maximum application payload with signature = 134 bytes (255 - 53 - 64 - 4).
- Maximum application payload unsigned = 198 bytes (255 - 53 - 4).
- Signatures survive multi-hop relaying without invalidation due to TTL/Hop masking.
