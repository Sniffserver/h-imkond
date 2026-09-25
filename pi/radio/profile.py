"""
Unified Radio Profile and Regional Compliance Policy for HÕIMU Pi Bridge

Single source of truth for SX1262 LoRa configuration, ETSI EU868 limits,
Semtech CAD parameters, and airtime duty-cycle accounting.
"""

from typing import List, Dict, Any

class RadioChannelConfig:
    def __init__(
        self,
        frequency_mhz: float,
        bandwidth_khz: float = 125.0,
        spreading_factor: int = 7,
        coding_rate: int = 1, # 4/5
        tx_power_dbm: int = 14,
        max_duty_cycle_pct: float = 1.0,
        role: str = "primary_mesh",
        description: str = ""
    ):
        self.frequency_mhz = frequency_mhz
        self.bandwidth_khz = bandwidth_khz
        self.spreading_factor = spreading_factor
        self.coding_rate = coding_rate
        self.tx_power_dbm = tx_power_dbm
        self.max_duty_cycle_pct = max_duty_cycle_pct
        self.role = role
        self.description = description

class RadioRegionPolicy:
    def __init__(
        self,
        region: str,
        name: str,
        default_channel: RadioChannelConfig,
        channels: List[RadioChannelConfig],
        cad_symbol_num: int = 4,
        cad_det_peak: int = 22,
        cad_det_min: int = 10,
        max_airtime_ms_per_hour: int = 36000
    ):
        self.region = region
        self.name = name
        self.default_channel = default_channel
        self.channels = channels
        self.cad_symbol_num = cad_symbol_num
        self.cad_det_peak = cad_det_peak
        self.cad_det_min = cad_det_min
        self.max_airtime_ms_per_hour = max_airtime_ms_per_hour

# Unified EU868 HÕIMU Profile
EU868_HOIMU_PROFILE = RadioRegionPolicy(
    region="EU868",
    name="EU868 HÕIMU Mesh Radio Profile",
    default_channel=RadioChannelConfig(
        frequency_mhz=868.1,
        bandwidth_khz=125.0,
        spreading_factor=7,
        coding_rate=1,
        tx_power_dbm=14,
        max_duty_cycle_pct=1.0,
        role="primary_mesh",
        description="Primary Community Mesh Channel"
    ),
    channels=[
        RadioChannelConfig(868.1, 125.0, 7, 1, 14, 1.0, "primary_mesh", "Primary Channel (g1)"),
        RadioChannelConfig(868.3, 125.0, 7, 1, 14, 1.0, "alternate_mesh", "Alternate Channel 1 (g1)"),
        RadioChannelConfig(868.5, 125.0, 7, 1, 14, 1.0, "alternate_mesh", "Alternate Channel 2 (g1)"),
        RadioChannelConfig(869.525, 125.0, 7, 1, 27, 10.0, "emergency_sos", "Emergency / SOS Channel (g3)"),
    ],
    cad_symbol_num=4,
    cad_det_peak=22,
    cad_det_min=10,
    max_airtime_ms_per_hour=36000
)

DEFAULT_RADIO_PROFILE = EU868_HOIMU_PROFILE
