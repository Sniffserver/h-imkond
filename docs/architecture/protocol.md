# Canonical Binary Wire Protocol Specification (PROTOCOL-001..005)

## Framing Structure

All runtimes (TypeScript Web/Android App, Raspberry Pi Python Daemon, ESP32 C++ Firmware) MUST implement the identical binary packet layout.

| Field | Type | Offset | Size (Bytes) | Description |
|---|---|---|---|---|
| `MAGIC` | `uint32 BE` | 0 | 4 | Magic marker `0x484F494D` ("HOIM") |
| `VERSION` | `uint8` | 4 | 1 | Protocol version `0x01` |
| `TYPE` | `uint8` | 5 | 1 | Packet type ID (0x01 MESSAGE, 0x02 DIRECT_ENCRYPTED, 0x03 SOS, 0x04 CRDT_SYNC, 0x05 ROUTE_ANNOUNCE, 0x06 ACK) |
| `FLAGS` | `uint8` | 6 | 1 | Bit flags (0x01 IS_SIGNED, 0x02 IS_ENCRYPTED, 0x04 IS_PRIORITY, 0x08 ACK_REQUESTED, 0x10 COMPRESSED) |
| `TTL` | `uint8` | 7 | 1 | Time-to-live hops remaining (default 7, max 15) |
| `HOP` | `uint8` | 8 | 1 | Hop count traversed |
| `SEQUENCE` | `uint32 BE` | 9 | 4 | Persistent epoch-seeded sequence counter |
| `ORIGIN_ID` | `bytes` | 13 | 8 | 8-byte UTF-8 ASCII node fingerprint |
| `DESTINATION_ID` | `bytes` | 21 | 8 | 8-byte UTF-8 ASCII node target (`*` for broadcast) |
| `PACKET_ID` | `bytes` | 29 | 16 | 16-byte raw UUID or hash |
| `CREATED_AT` | `uint32 BE` | 45 | 4 | Unix epoch timestamp in seconds |
| `LIFETIME` | `uint16 BE` | 49 | 2 | Lifetime in seconds (`expiresAt = createdAt + lifetime`) |
| `PAYLOAD_LENGTH` | `uint16 BE` | 51 | 2 | Application payload length $N$ in bytes |
| `PAYLOAD` | `bytes` | 53 | $N$ | Application payload (encrypted ciphertext or canonical JSON) |
| `SIGNATURE` | `bytes` | 53+$N$ | 64 | Optional Ed25519 signature (present ONLY if `FLAGS & 0x01`) |
| `CRC32` | `uint32 BE` | Tail-4 | 4 | IEEE 802.3 CRC32 over Header + Payload + Signature |

### Overhead & MTU
- **Fixed Header Size**: 53 Bytes
- **Trailer (CRC32)**: 4 Bytes
- **Physical LoRa MTU**: 255 Bytes (Semtech SX1262)
- **Signed Packet Payload Capacity**: $255 - 53 - 64 - 4 = 134$ Bytes
- **Unsigned Packet Payload Capacity**: $255 - 53 - 4 = 198$ Bytes

### Signature Invariants
Signatures are computed over `Header (with masked TTL=0 and Hop=0) + Payload`. This allows intermediate mesh repeaters to decrement TTL and increment hop count across multiple radio hops without breaking origin verification.
