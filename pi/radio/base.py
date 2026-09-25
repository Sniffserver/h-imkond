"""
HÕIMU Radio Abstraction Layer (RAL) Base Interface
Unified single interface contract across all physical and virtual radio transports:
SX1262 LoRa, Emulator, BLE, and Wi-Fi.
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
    total_airtime_ms: int = 0 # alias
    cad_busy_count: int = 0
    last_rssi: Optional[float] = None
    last_snr: Optional[float] = None

class BaseRadio(ABC):
    """
    Unified abstract interface for all mesh physical and virtual transports.
    """

    @abstractmethod
    def start(self) -> bool:
        """Initializes and powers on the radio hardware / interface."""
        pass

    @abstractmethod
    def stop(self) -> None:
        """Stops and powers down the radio hardware / interface."""
        pass

    @abstractmethod
    def transmit(self, data: bytes, priority: int = 1) -> bool:
        """
        Transmits raw packet data over RF link.
        Priority: 0=low/telemetry, 1=normal/msg, 2=high/ack, 3=emergency/sos.
        """
        pass

    @abstractmethod
    def receive(self, timeout_s: float = 0.0) -> Optional[bytes]:
        """
        Receives next frame from hardware buffers or event queue.
        Returns raw bytes if frame is available, or None.
        """
        pass

    @abstractmethod
    def cad(self) -> bool:
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
    def get_capabilities(self) -> Dict[str, Any]:
        """Returns physical radio hardware capabilities."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if the physical hardware is detected and functional."""
        pass

    # =========================================================================
    # Compatibility Aliases (ensures zero breaking changes for existing code)
    # =========================================================================
    def init_hardware(self) -> bool:
        return self.start()

    def receive_packet(self) -> Optional[bytes]:
        return self.receive()

    def perform_cad(self) -> bool:
        return self.cad()

    def send_packet(self, data: bytes, priority: int = 1) -> bool:
        return self.transmit(data, priority)
