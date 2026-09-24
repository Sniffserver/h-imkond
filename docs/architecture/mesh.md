# Mesh Transport Architecture

## Subsystem Architecture

- **Bounded Flooding Engine**: Deduplication cache based on 8-byte packet GUID hashes.
- **Route Selection & ACK Management**: Exponential backoff retransmission with persistent outbox queue.
- **Telemetry Counters**: Real counters for `packetsReceived`, `packetsDroppedDuplicate`, `packetsDroppedTTL`, `packetsForwarded`, `packetsDelivered`, `ackSuccessRate`, `averageHops`, `averageLatency`.
