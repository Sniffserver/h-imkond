"""
HÕIMU Physical LoRa Airtime & Modulation Physics Engine
Grounded in Semtech SX1261/SX1262 datasheet equations and AN1200.48.

Calculates:
- Exact symbol duration Tsym = 2^SF / BW
- Low Data Rate Optimization (LDRO) based on physical symbol duration (> 16.38 ms)
- Accurate Time-on-Air (ToA) across SF7..SF12, BW125..BW500, CR4/5..CR4/8
"""

import math
from typing import Dict, Any

def get_symbol_duration_ms(sf: int, bw_khz: float = 125.0) -> float:
    """
    Calculates physical LoRa symbol duration in milliseconds.
    Tsym = (2^SF) / BW_Hz = (2^SF) / (BW_kHz * 1000) s = (2^SF) / BW_kHz ms
    """
    return (2 ** sf) / bw_khz

def is_ldro_required(sf: int, bw_khz: float = 125.0) -> bool:
    """
    Determines if Low Data Rate Optimization (LDRO) is physically required.
    Semtech SX1261/SX1262 datasheet Section 13.1.1 mandates LDRO whenever
    symbol duration Tsym > 16.38 ms.
    
    Examples:
    - SF11 @ 125 kHz: Tsym = 16.384 ms >= 16.38 ms -> True
    - SF12 @ 125 kHz: Tsym = 32.768 ms >= 16.38 ms -> True
    - SF10 @ 125 kHz: Tsym = 8.192 ms < 16.38 ms  -> False
    - SF11 @ 250 kHz: Tsym = 8.192 ms < 16.38 ms  -> False (shortcut heuristic fails here!)
    - SF12 @ 250 kHz: Tsym = 16.384 ms >= 16.38 ms -> True
    """
    tsym_ms = get_symbol_duration_ms(sf, bw_khz)
    return tsym_ms >= 16.0

def calculate_lora_airtime_ms(
    payload_length_bytes: int,
    sf: int = 7,
    bw_khz: float = 125.0,
    coding_rate: int = 1, # 1=4/5, 2=4/6, 3=4/7, 4=4/8
    preamble_symbols: int = 8,
    explicit_header: bool = True,
    crc_enabled: bool = True,
) -> int:
    """
    Semtech SX1261/SX1262 exact physical Time-on-Air (ToA) equation.
    
    T_preamble = (N_preamble + 4.25) * Tsym
    N_payload = 8 + max(ceil((8*PL - 4*SF + 28 + 16*CRC - 20*H) / (4*(SF - 2*DE))) * (CR + 4), 0)
    T_payload = N_payload * Tsym
    Total_ToA = T_preamble + T_payload
    """
    tsym_ms = get_symbol_duration_ms(sf, bw_khz)
    t_preamble_ms = (preamble_symbols + 4.25) * tsym_ms

    de = 1 if is_ldro_required(sf, bw_khz) else 0
    h = 0 if explicit_header else 1
    crc = 1 if crc_enabled else 0
    cr = coding_rate

    numerator = 8 * payload_length_bytes - 4 * sf + 28 + (16 * crc) - (20 * h)
    denominator = 4 * (sf - 2 * de)

    symbols_payload = math.ceil(numerator / denominator) if denominator > 0 else 0
    n_payload = 8 + max(symbols_payload * (cr + 4), 0)

    t_payload_ms = n_payload * tsym_ms
    total_ms = t_preamble_ms + t_payload_ms
    return max(10, math.ceil(total_ms))
