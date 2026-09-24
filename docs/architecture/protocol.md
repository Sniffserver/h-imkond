# Canonical Wire Protocol Specification

## Framing Structure

All runtimes (TypeScript WebApp, Raspberry Pi Python Daemon, ESP32 C++ Firmware) MUST implement the identical binary packet layout.

| Field | Type | Size (Bytes) | Description |
|---|---|---|---|
| `MAGIC` | `uint16` | 2 | Magic marker `0x484D` ("HM") |
| `VERSION` | `uint8` | 1 | Protocol version `0x01` |
| `TYPE` | `uint8` | 1 | Packet type ID (0x01 DATA, 0x02 ACK, 0x03 SOS, 0x04 ROUTING, 0x05 CRDT) |
| `FLAGS` | `uint8` | 1 | Bit flags (0x01 ENCRYPTED, 0x02 SIGNED, 0x04 HIGH_PRIORITY, 0x08 RELAY_ALLOWED) |
| `TTL` | `uint8` | 1 | Time-to-live hops remaining |
| `HOP` | `uint8` | 1 | Hop count traversed |
| `SEQUENCE` | `uint16` | 2 | Per-origin sequence number |
| `ORIGIN_ID` | `bytes` | 8 | Truncated origin node SHA-256 hash / key prefix |
| `DESTINATION_ID` | `bytes` | 8 | Target node SHA-256 prefix or `0xFFFFFFFFFFFFFFFF` broadcast |
| `PACKET_ID` | `bytes` | 8 | Unique packet GUID hash |
| `TIMESTAMP` | `uint32` | 4 | Epoch timestamp in seconds |
| `PAYLOAD_LENGTH` | `uint16` | 2 | Length of payload in bytes |
| `PAYLOAD` | `bytes` | Var | Arbitrary encrypted or plaintext payload |
| `SIGNATURE` | `bytes` | 64 | Ed25519 signature over header + payload |
| `CRC32` | `uint32` | 4 | CRC32 checksum over header + payload + signature |

Total Fixed Header + Tail Overhead: 39 Bytes + Payload Length + 64 Byte Signature + 4 Byte CRC32.
