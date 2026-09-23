"""
HÕIMU Mesh Network Router
Coordinates packet deduplication, store-and-forward routing, TTL management,
delivery state separation, and multi-radio transmission.
"""

import time
import logging
from typing import Dict, Any, Optional, List

from ..protocol.codec import BinaryCodec
from ..protocol.packets import HoimuPacketType, PacketFlags
from .dedup import DedupFilter
from .ttl import TTLManager
from .retry import RetryManager
from ..radio.base import BaseRadio

logger = logging.getLogger("hoimu.router")

class MeshRouter:
    def __init__(
        self,
        node_id: str,
        radio: BaseRadio,
        inbox_store = None,
        outbox_store = None,
        peer_store = None
    ):
        self.node_id = node_id.strip()
        self.radio = radio
        self.inbox_store = inbox_store
        self.outbox_store = outbox_store
        self.peer_store = peer_store

        self.dedup = DedupFilter(max_size=2000, ttl_seconds=600.0)
        self.retry_manager = RetryManager()

        self._total_acks_requested = 0
        self._total_acks_received = 0
        self._total_delivered = 0
        self._total_hops_sum = 0
        self._total_latency_sum_ms = 0
        self._latency_count = 0

        self.stats = {
            "packetsReceived": 0,
            "packetsDroppedDuplicate": 0,
            "packetsDroppedTTL": 0,
            "packetsForwarded": 0,
            "packetsDelivered": 0,
            "ackSuccessRate": 100.0,
            "averageHops": 0.0,
            "averageLatency": 0.0,
            # Legacy keys for backward compatibility
            "packets_received": 0,
            "packets_forwarded": 0,
            "packets_delivered_local": 0,
            "packets_dropped_duplicate": 0,
            "packets_dropped_ttl": 0,
            "packets_dropped_crc": 0,
        }

        # On boot, restore outbox and remove expired packets
        if self.outbox_store and hasattr(self.outbox_store, "restore_and_prune_expired"):
            try:
                pending = self.outbox_store.restore_and_prune_expired()
                logger.info(f"[Router] Restored outbox on boot: {len(pending)} pending packets valid")
            except Exception as e:
                logger.error(f"[Router] Failed to restore outbox on boot: {e}")

    def process_incoming_bytes(self, raw_bytes: bytes) -> Optional[Dict[str, Any]]:
        """
        Processes a raw frame received from physical radio:
        1. Decode and verify 32-bit CRC (8.2)
        2. Deduplication check (LRU)
        3. Peer discovery / metric update
        4. Routing vs Local Delivery dispatch
        5. Forwarding / Relay if eligible
        """
        decoded = BinaryCodec.decode(raw_bytes)
        if not decoded:
            self.stats["packets_dropped_crc"] += 1
            logger.warning("[Router] Inbound packet dropped: invalid framing or CRC32 failure")
            return None

        packet_id = decoded["packetId"]
        if self.dedup.is_seen(packet_id):
            self.stats["packetsDroppedDuplicate"] += 1
            self.stats["packets_dropped_duplicate"] += 1
            logger.debug(f"[Router] Dropping duplicate packet {packet_id}")
            return None

        self.stats["packetsReceived"] += 1
        self.stats["packets_received"] += 1
        origin_id = decoded["originId"]
        destination_id = decoded["destinationId"]

        # Handle ACK packets
        if decoded.get("type") == HoimuPacketType.ACK:
            ack_target = decoded.get("payload", {}).get("ackForPacketId") if isinstance(decoded.get("payload"), dict) else None
            if ack_target and self.outbox_store:
                self.outbox_store.update_status(ack_target, "acknowledged")
                self._total_acks_received += 1
                if self._total_acks_requested > 0:
                    self.stats["ackSuccessRate"] = round(min(100.0, (self._total_acks_received / self._total_acks_requested) * 100.0), 1)

        # Update peer store
        if self.peer_store and origin_id:
            try:
                self.peer_store.upsert_peer(
                    node_id=origin_id,
                    last_seen=int(time.time()),
                    hop_count=decoded.get("hopCount", 0)
                )
            except Exception as e:
                logger.error(f"[Router] Peer store update error: {e}")

        # Local delivery check: Destination matches this node, or is broadcast ('*', 'FFFFFFFF', or empty)
        is_for_us = (
            destination_id == self.node_id or
            destination_id in ("*", "FFFFFFFF", "00000000", "")
        )

        if is_for_us:
            self.stats["packetsDelivered"] += 1
            self.stats["packets_delivered_local"] += 1
            self._total_delivered += 1
            self._total_hops_sum += decoded.get("hopCount", 0)
            self.stats["averageHops"] = round(self._total_hops_sum / self._total_delivered, 1)

            logger.info(f"[Router] Inbound packet {packet_id} delivered to local inbox (Type: {decoded['type']})")
            if self.inbox_store:
                try:
                    self.inbox_store.save(decoded)
                except Exception as e:
                    logger.error(f"[Router] Inbox store error: {e}")

        # Forward / Store-and-Forward relay check
        if destination_id != self.node_id:
            forwardable = TTLManager.validate_and_decrement(decoded)
            if forwardable:
                self.stats["packetsForwarded"] += 1
                self.stats["packets_forwarded"] += 1
                logger.info(f"[Router] Forwarding packet {packet_id} (TTL: {forwardable['ttl']}, Hops: {forwardable['hopCount']})")
                try:
                    re_encoded = BinaryCodec.encode(
                        packet_type=forwardable["type"],
                        origin_id=forwardable["originId"],
                        dest_id=forwardable["destinationId"],
                        packet_id=forwardable["packetId"],
                        ttl=forwardable["ttl"],
                        sequence=forwardable["sequence"],
                        payload_data=forwardable["payload"],
                        signature=forwardable.get("signature"),
                        flags=forwardable.get("flags", 0),
                        hop_count=forwardable["hopCount"]
                    )
                    priority = 3 if forwardable["type"] == HoimuPacketType.SOS else 1
                    self.radio.transmit(re_encoded, priority=priority)
                except Exception as e:
                    logger.error(f"[Router] Relay transmission failed: {e}")
            else:
                self.stats["packetsDroppedTTL"] += 1
                self.stats["packets_dropped_ttl"] += 1
                logger.debug(f"[Router] Packet {packet_id} TTL expired; not forwarded")

        return decoded

    def send_outbound(
        self,
        dest_id: str,
        payload: Any,
        packet_type: int = HoimuPacketType.MESSAGE,
        flags: int = 0,
        signature: Optional[str] = None
    ) -> bool:
        """
        Originates an outbound packet from this node.
        """
        import uuid
        packet_id = uuid.uuid4().hex[:8].upper()
        encoded = BinaryCodec.encode(
            packet_type=packet_type,
            origin_id=self.node_id,
            dest_id=dest_id,
            packet_id=packet_id,
            ttl=7,
            sequence=int(time.time()) & 0xFFFFFFFF,
            payload_data=payload,
            signature=signature,
            flags=flags,
            hop_count=0
        )

        # Mark as seen so we don't process our own echo
        self.dedup.is_seen(packet_id)

        if dest_id not in ("*", "FFFFFFFF") and packet_type != HoimuPacketType.ACK:
            self._total_acks_requested += 1

        priority = 3 if packet_type == HoimuPacketType.SOS else (2 if flags & PacketFlags.IS_PRIORITY else 1)
        success = self.radio.transmit(encoded, priority=priority)

        if self.outbox_store:
            try:
                self.outbox_store.save({
                    "packet_id": packet_id,
                    "destination_id": dest_id,
                    "payload": payload,
                    "status": "sent" if success else "retrying",
                    "attempts": 1,
                    "created_at": int(time.time())
                })
            except Exception:
                pass

        return success

    def poll_radio(self):
        """
        Polls the radio RX buffer and processes any available packet.
        """
        raw = self.radio.receive_packet()
        if raw:
            return self.process_incoming_bytes(raw)
        return None
