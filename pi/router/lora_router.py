"""
LoRa Gateway Router on Raspberry Pi
Coordinates BLE <-> SX1262 LoRa bidirectional bridging and store-and-forward relaying.
"""

import logging
from pi.protocol.frame import BinaryCodec
from pi.storage.sqlite_store import SQLiteMeshStore
from pi.radio.sx1262 import SX1262Driver
from pi.radio.ble import BLEBridge

logger = logging.getLogger("hoimu.router")

class LoRaGatewayRouter:
    def __init__(self, node_id="PI-GW-01", sx1262: SX1262Driver = None, ble: BLEBridge = None, store: SQLiteMeshStore = None):
        self.node_id = node_id
        self.sx1262 = sx1262 or SX1262Driver()
        self.ble = ble or BLEBridge()
        self.store = store or SQLiteMeshStore()
        self.packets_relayed = 0

    def handle_ingress_from_phone(self, raw_bytes: bytes) -> bool:
        """Phone sends packet over BLE to Pi -> Pi forwards over LoRa SX1262"""
        decoded = BinaryCodec.decode(raw_bytes)
        if not decoded:
            logger.warning("Ingress from phone failed: corrupted frame or CRC mismatch")
            return False

        packet_id = decoded["packetId"]
        if self.store.is_duplicate(packet_id):
            logger.info(f"Duplicate packet {packet_id} suppressed")
            return False

        self.store.save_packet(
            packet_id, decoded["originId"], decoded["destinationId"],
            decoded["ttl"], decoded["hopCount"], raw_bytes
        )

        logger.info(f"[ROUTER] Ingress from Phone ({decoded['originId']} -> {decoded['destinationId']}). Transmitting over LoRa...")
        success = self.sx1262.transmit(raw_bytes)
        if success:
            self.packets_relayed += 1
        return success

    def handle_ingress_from_lora(self, raw_bytes: bytes):
        """Packet received over LoRa SX1262 -> Pi validates, decrements TTL, forwards to BLE phones and/or relays"""
        decoded = BinaryCodec.decode(raw_bytes)
        if not decoded:
            return

        packet_id = decoded["packetId"]
        if self.store.is_duplicate(packet_id):
            logger.info(f"LoRa RX: Duplicate {packet_id} dropped")
            return

        logger.info(f"[ROUTER] LoRa RX from {decoded['originId']}: TTL={decoded['ttl']}, payload={decoded['payload']}")

        # Forward to local connected phones over BLE
        self.ble.send_notification_to_phones(raw_bytes)

        # Multi-hop Relay if TTL > 1
        ttl = decoded["ttl"]
        if ttl > 1 and decoded["destinationId"] != self.node_id:
            logger.info(f"[ROUTER] Relaying packet {packet_id} over LoRa with TTL={ttl - 1}")
            # Re-encode with decremented TTL and incremented hopCount
            forwarded_bytes = BinaryCodec.encode(
                decoded["type"], decoded["originId"], decoded["destinationId"],
                packet_id, ttl - 1, decoded["sequence"], decoded["payload"]
            )
            self.sx1262.transmit(forwarded_bytes)
            self.packets_relayed += 1
