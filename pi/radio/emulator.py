"""
HÕIMU LoRa Virtual Radio & Channel Emulator for Raspberry Pi Headless Testing
Simulates physical RF path loss, channel activity, collisions, and real Time-on-Air (ToA).
"""

import time
import random
from typing import Optional, List, Tuple, Dict, Any
from .base import BaseRadio, RadioStats
from .airtime import calculate_lora_airtime_ms, is_ldro_required
from .profile import DEFAULT_RADIO_PROFILE

class EmulatorRadio(BaseRadio):
    def __init__(
        self,
        node_id: str = "PI-EMU-01",
        packet_loss_rate: float = 0.0,
        frequency_mhz: float = DEFAULT_RADIO_PROFILE.default_channel.frequency_mhz,
        spreading_factor: int = DEFAULT_RADIO_PROFILE.default_channel.spreading_factor,
        bandwidth_khz: float = DEFAULT_RADIO_PROFILE.default_channel.bandwidth_khz,
        coding_rate: int = DEFAULT_RADIO_PROFILE.default_channel.coding_rate,
        tx_power_dbm: int = DEFAULT_RADIO_PROFILE.default_channel.tx_power_dbm
    ):
        self.node_id = node_id
        self.packet_loss_rate = packet_loss_rate
        self.frequency_mhz = frequency_mhz
        self.spreading_factor = spreading_factor
        self.bandwidth_khz = bandwidth_khz
        self.coding_rate = coding_rate
        self.tx_power_dbm = tx_power_dbm

        self.stats = RadioStats()
        self.rx_queue: List[bytes] = []
        self.is_active = True
        self._history: List[Tuple[float, int]] = [] # (timestamp, airtime_ms)

    def start(self) -> bool:
        self.is_active = True
        return True

    def stop(self) -> None:
        self.is_active = False

    def transmit(self, data: bytes, priority: int = 1) -> bool:
        if not self.is_active:
            return False

        # Simulate channel loss
        if self.packet_loss_rate > 0 and random.random() < self.packet_loss_rate:
            self.stats.tx_errors += 1
            return False

        airtime_ms = self.calculate_airtime_ms(len(data))
        self.stats.tx_count += 1
        self.stats.airtime_ms_total += airtime_ms
        self.stats.total_airtime_ms += airtime_ms
        self._history.append((time.time(), airtime_ms))
        return True

    def receive(self, timeout_s: float = 0.0) -> Optional[bytes]:
        if not self.is_active or not self.rx_queue:
            return None

        packet = self.rx_queue.pop(0)
        self.stats.rx_count += 1
        self.stats.last_rssi = -75.0 + random.uniform(-5.0, 5.0)
        self.stats.last_snr = 9.5 + random.uniform(-1.0, 2.0)
        return packet

    def cad(self) -> bool:
        """Virtual CAD returns True (channel clear) unless configured otherwise."""
        return True

    def calculate_airtime_ms(self, payload_length: int) -> int:
        """Physical Semtech LoRa Time-on-Air based on modulation parameters and symbol duration."""
        return calculate_lora_airtime_ms(
            payload_length_bytes=payload_length,
            sf=self.spreading_factor,
            bw_khz=self.bandwidth_khz,
            coding_rate=self.coding_rate,
            preamble_symbols=8,
            explicit_header=True,
            crc_enabled=True,
        )

    def get_rolling_hour_airtime_ms(self) -> int:
        cutoff = time.time() - 3600.0
        self._history = [r for r in self._history if r[0] >= cutoff]
        return sum(r[1] for r in self._history)

    def inject_rx_packet(self, data: bytes) -> None:
        """Inject an inbound RF packet into the virtual receiver queue."""
        self.rx_queue.append(data)

    def get_stats(self) -> Dict[str, Any]:
        return {
            "type": "emulator",
            "is_active": self.is_active,
            "tx_count": self.stats.tx_count,
            "rx_count": self.stats.rx_count,
            "tx_errors": self.stats.tx_errors,
            "airtime_ms_total": self.stats.airtime_ms_total,
            "rolling_hour_airtime_ms": self.get_rolling_hour_airtime_ms(),
            "last_rssi": self.stats.last_rssi,
            "last_snr": self.stats.last_snr,
        }

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "driver": "EmulatorRadio",
            "frequency_mhz": self.frequency_mhz,
            "spreading_factor": self.spreading_factor,
            "bandwidth_khz": self.bandwidth_khz,
            "ldro_enabled": is_ldro_required(self.spreading_factor, self.bandwidth_khz),
            "simulated": True,
        }

    def is_available(self) -> bool:
        return self.is_active
