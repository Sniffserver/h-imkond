"""
Bluetooth Low Energy (BLE) Peripheral Radio Adapter for HÕIMU Pi Gateway
"""

import logging
from typing import Optional, Dict, Any
from .base import BaseRadio, RadioStats

logger = logging.getLogger("hoimu.ble")

class BleRadio(BaseRadio):
    def __init__(self, service_uuid: str = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"):
        self.service_uuid = service_uuid
        self.is_advertising = False
        self.connected_devices = set()
        self.stats = RadioStats()
        self._rx_queue = []

    def init_hardware(self) -> bool:
        logger.info(f"Initializing BLE GATT peripheral for service {self.service_uuid}")
        self.is_advertising = True
        return True

    def transmit(self, data: bytes, priority: int = 1) -> bool:
        logger.info(f"[BLE-TX] Sending {len(data)} bytes to {len(self.connected_devices)} peer(s)")
        self.stats.tx_count += 1
        return True

    def receive_packet(self) -> Optional[bytes]:
        if self._rx_queue:
            pkt = self._rx_queue.pop(0)
            self.stats.rx_count += 1
            return pkt
        return None

    def perform_cad(self) -> bool:
        # BLE uses frequency hopping and connection events; always ready
        return True

    def get_stats(self) -> Dict[str, Any]:
        return {
            "type": "ble",
            "is_advertising": self.is_advertising,
            "connected_count": len(self.connected_devices),
            "tx_count": self.stats.tx_count,
            "rx_count": self.stats.rx_count,
        }

    def is_available(self) -> bool:
        return True

# Compatibility alias
BLEBridge = BleRadio
