"""
HÕIMU Radio Abstraction Layer (RAL) Base Interface
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class RadioStats:
    tx_count: int = 0
    rx_count: int = 0
    tx_errors: int = 0
    rx_errors: int = 0
    airtime_ms_total: int = 0
    cad_busy_count: int = 0
    last_rssi: Optional[float] = None
    last_snr: Optional[float] = None

class BaseRadio(ABC):
    """
    Abstract interface for all mesh physical transports (SX1262 LoRa, BLE, WiFi-Direct).
    """

    @abstractmethod
    def init_hardware(self) -> bool:
        """Initializes SPI, GPIO, or radio hardware interfaces."""
        pass

    @abstractmethod
    def transmit(self, data: bytes, priority: int = 1) -> bool:
        """
        Transmits raw packet data over RF link.
        Priority: 0=low/telemetry, 1=normal/msg, 2=high/ack, 3=emergency/sos.
        """
        pass

    @abstractmethod
    def receive_packet(self) -> Optional[bytes]:
        """
        Polls or reads next received frame from hardware buffers.
        Returns raw bytes if frame is available, or None.
        """
        pass

    @abstractmethod
    def perform_cad(self) -> bool:
        """
        Performs physical Channel Activity Detection (CAD).
        Returns True if channel is clear, False if channel is busy.
        """
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Returns physical radio status and statistics."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if the physical hardware is detected and functional."""
        pass
