"""
Wi-Fi Direct / Ad-hoc Local Transport Radio Adapter for HÕIMU Pi Gateway
"""

import logging
from typing import Optional, Dict, Any
from .base import BaseRadio, RadioStats

logger = logging.getLogger("hoimu.wifi")

class WifiDirectRadio(BaseRadio):
    def __init__(self, interface: str = "wlan0", port: int = 8999):
        self.interface = interface
        self.port = port
        self.is_active = False
        self.stats = RadioStats()
        self._rx_queue = []

    def start(self) -> bool:
        logger.info(f"Initializing Wi-Fi Direct interface on {self.interface}:{self.port}")
        self.is_active = True
        return True

    def stop(self) -> None:
        self.is_active = False

    def transmit(self, data: bytes, priority: int = 1) -> bool:
        logger.info(f"[WiFi-TX] Broadcast {len(data)} bytes over {self.interface}")
        self.stats.tx_count += 1
        return True

    def receive(self, timeout_s: float = 0.0) -> Optional[bytes]:
        if self._rx_queue:
            pkt = self._rx_queue.pop(0)
            self.stats.rx_count += 1
            return pkt
        return None

    def cad(self) -> bool:
        return True

    def get_stats(self) -> Dict[str, Any]:
        return {
            "type": "wifi",
            "interface": self.interface,
            "port": self.port,
            "is_active": self.is_active,
            "tx_count": self.stats.tx_count,
            "rx_count": self.stats.rx_count,
        }

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "driver": "WifiDirectRadio",
            "interface": self.interface,
            "port": self.port,
            "throughput_mbps": 54,
        }

    def is_available(self) -> bool:
        return self.is_active
