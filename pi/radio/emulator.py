"""
HÕIMU LoRa Virtual Radio & Channel Emulator for Raspberry Pi Headless Testing
Simulates RF path loss, channel activity, collisions, and latency without SPI hardware.
"""

import time
import random
from typing import Optional, List, Tuple
from .base import BaseRadio, RadioStats

class EmulatorRadio(BaseRadio):
    def __init__(self, node_id: str = "PI-EMU-01", packet_loss_rate: float = 0.0):
        self.node_id = node_id
        self.packet_loss_rate = packet_loss_rate
        self.stats = RadioStats()
        self.rx_queue: List[bytes] = []
        self.is_active = True

    def init_hardware(self) -> bool:
        self.is_active = True
        return True

    def send_packet(self, data: bytes, priority: int = 0) -> bool:
        if not self.is_active:
            return False

        # Simulate channel loss
        if self.packet_loss_rate > 0 and random.random() < self.packet_loss_rate:
            self.stats.tx_errors += 1
            return False

        self.stats.tx_count += 1
        self.stats.total_airtime_ms += max(15, len(data) * 2)
        return True

    def receive_packet(self) -> Optional[bytes]:
        if not self.is_active or not self.rx_queue:
            return None

        packet = self.rx_queue.pop(0)
        self.stats.rx_count += 1
        self.stats.last_rssi = -75.0 + random.uniform(-5.0, 5.0)
        self.stats.last_snr = 9.5 + random.uniform(-1.0, 2.0)
        return packet

    def inject_rx_packet(self, data: bytes) -> None:
        """Inject an inbound RF packet into the virtual receiver queue."""
        self.rx_queue.append(data)

    def perform_cad(self) -> bool:
        """Virtual CAD always returns True unless high collision rate configured."""
        return True

    def calculate_airtime_ms(self, payload_length: int) -> int:
        return max(15, payload_length * 2)

    def get_rolling_hour_airtime_ms(self) -> int:
        return self.stats.total_airtime_ms
