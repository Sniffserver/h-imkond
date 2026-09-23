"""
Hardware Driver for Semtech SX1262 LoRa Transceiver via SPI & GPIO on Raspberry Pi Zero 2 W

Implements full physical pipeline:
- 8.1 SX1262 Initialization (reset, standby, packet type, frequency, PA config, TX params, buffer base, modulation, packet params, IRQ)
- 8.2 Real RX path (IRQ -> GetIrqStatus -> GetRxBufferStatus -> ReadBuffer -> Unpack -> CRC)
- 8.3 CAD / Collision Handling (Physical Channel Activity Detection & exponential slot backoff)
- 8.4 Persistent rolling 1-hour duty cycle accounting with priority awareness
"""

import time
import math
import random
import logging
from typing import Optional, Tuple, Dict, Any, List
from .base import BaseRadio, RadioStats

logger = logging.getLogger("hoimu.sx1262")

# SX1262 Opcodes
OP_SET_STANDBY = 0x80
OP_SET_PACKET_TYPE = 0x8A
OP_SET_RF_FREQUENCY = 0x86
OP_SET_PA_CONFIG = 0x95
OP_SET_TX_PARAMS = 0x8E
OP_SET_BUFFER_BASE_ADDRESS = 0x8F
OP_SET_MODULATION_PARAMS = 0x8B
OP_SET_PACKET_PARAMS = 0x8C
OP_SET_DIO_IRQ_PARAMS = 0x08
OP_GET_IRQ_STATUS = 0x12
OP_CLEAR_IRQ_STATUS = 0x02
OP_SET_TX = 0x83
OP_SET_RX = 0x82
OP_SET_CAD = 0xC5
OP_SET_CAD_PARAMS = 0x88
OP_GET_RX_BUFFER_STATUS = 0x13
OP_WRITE_BUFFER = 0x0E
OP_READ_BUFFER = 0x1E
OP_GET_PACKET_STATUS = 0x14
OP_GET_STATUS = 0xC0

# SX1262 IRQ Masks
IRQ_TX_DONE = 0x0001
IRQ_RX_DONE = 0x0002
IRQ_PREAMBLE_DETECTED = 0x0004
IRQ_SYNC_WORD_VALID = 0x0008
IRQ_HEADER_VALID = 0x0010
IRQ_HEADER_ERROR = 0x0020
IRQ_CRC_ERROR = 0x0040
IRQ_CAD_DONE = 0x0080
IRQ_CAD_DETECTED = 0x0100
IRQ_TIMEOUT = 0x0200
IRQ_ALL = 0x03FF

# Packet types
PACKET_TYPE_LORA = 0x01

# Standby modes
STDBY_RC = 0x00
STDBY_XOSC = 0x01

class SX1262Driver(BaseRadio):
    def __init__(
        self,
        spi_bus: int = 0,
        spi_device: int = 0,
        reset_pin: int = 18,
        busy_pin: int = 24,
        dio1_pin: int = 23,
        frequency_mhz: float = 868.0,
        bandwidth_khz: float = 125.0,
        spreading_factor: int = 7,
        coding_rate: int = 1, # 4/5
        tx_power_dbm: int = 14,
        duty_cycle_storage = None
    ):
        self.spi_bus = spi_bus
        self.spi_device = spi_device
        self.reset_pin = reset_pin
        self.busy_pin = busy_pin
        self.dio1_pin = dio1_pin
        self.frequency_mhz = frequency_mhz
        self.bandwidth_khz = bandwidth_khz
        self.spreading_factor = spreading_factor
        self.coding_rate = coding_rate
        self.tx_power_dbm = tx_power_dbm

        self.spi = None
        self.gpio = None
        self.is_hardware_available = False

        self.stats = RadioStats()
        self.duty_cycle_storage = duty_cycle_storage
        self._duty_cycle_history: List[Tuple[float, int, int]] = [] # (timestamp, airtime_ms, priority)

        # Virtual RX queue for loopback/testing when physical hardware absent
        self._virtual_rx_queue: List[bytes] = []

    # =========================================================================
    # 8.1 SX1262 Initialization
    # =========================================================================
    def init_hardware(self) -> bool:
        """
        Full 10-step SX1262 hardware initialization sequence.
        """
        try:
            import spidev
            import RPi.GPIO as GPIO

            self.gpio = GPIO
            self.gpio.setmode(GPIO.BCM)
            self.gpio.setup(self.reset_pin, GPIO.OUT)
            self.gpio.setup(self.busy_pin, GPIO.IN)
            self.gpio.setup(self.dio1_pin, GPIO.IN)

            self.spi = spidev.SpiDev()
            self.spi.open(self.spi_bus, self.spi_device)
            self.spi.max_speed_hz = 2000000
            self.spi.mode = 0

            # Step 1: Reset
            self._reset()

            # Step 2: Standby RC
            self._set_standby(STDBY_RC)

            # Step 3: Packet Type LoRa
            self._set_packet_type(PACKET_TYPE_LORA)

            # Step 4: RF Frequency
            self._set_rf_frequency(self.frequency_mhz)

            # Step 5: PA Configuration (+14dBm / +22dBm SX1262)
            self._set_pa_config(pa_duty_cycle=0x04, hp_max=0x07, device_sel=0x00, pa_lut=0x01)

            # Step 6: TX Params
            self._set_tx_params(self.tx_power_dbm, ramp_time=0x02) # 40us ramp

            # Step 7: Buffer Base Addresses
            self._set_buffer_base_address(tx_base=0x00, rx_base=0x00)

            # Step 8: Modulation Params (SF, BW, CR, LowDataRateOptimize)
            self._set_modulation_params(self.spreading_factor, bw_khz=self.bandwidth_khz, cr=self.coding_rate)

            # Step 9: Packet Params (Preamble=8, Explicit header, Max 255 payload, CRC ON, Standard IQ)
            self._set_packet_params(preamble_len=8, header_type=0, payload_len=255, crc_on=1, invert_iq=0)

            # Step 10: IRQ Params (Route RX_DONE, TX_DONE, CAD_DONE, CAD_DETECTED to DIO1)
            irq_mask = IRQ_RX_DONE | IRQ_TX_DONE | IRQ_CAD_DONE | IRQ_CAD_DETECTED | IRQ_CRC_ERROR | IRQ_TIMEOUT
            self._set_dio_irq_params(irq_mask, dio1_mask=irq_mask)

            # Enter Continuous Receive mode
            self._set_rx(timeout=0x000000)

            self.is_hardware_available = True
            logger.info(f"SX1262 initialized on SPI {self.spi_bus}.{self.spi_device} @ {self.frequency_mhz} MHz")
            return True

        except Exception as e:
            logger.warning(f"SX1262 hardware SPI/GPIO unavailable ({e}). Operating in software simulation mode.")
            self.is_hardware_available = False
            return False

    def _wait_busy(self, timeout_s: float = 0.1):
        if not self.gpio or not self.is_hardware_available:
            return
        start = time.time()
        while self.gpio.input(self.busy_pin) == 1:
            if time.time() - start > timeout_s:
                logger.warning("SX1262 busy wait timeout")
                break
            time.sleep(0.0005)

    def _reset(self):
        if self.gpio:
            self.gpio.output(self.reset_pin, self.gpio.LOW)
            time.sleep(0.01)
            self.gpio.output(self.reset_pin, self.gpio.HIGH)
            time.sleep(0.02)
        self._wait_busy()

    def _set_standby(self, mode: int = STDBY_RC):
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([OP_SET_STANDBY, mode])

    def _set_packet_type(self, packet_type: int = PACKET_TYPE_LORA):
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([OP_SET_PACKET_TYPE, packet_type])

    def _set_rf_frequency(self, freq_mhz: float):
        self.frequency_mhz = freq_mhz
        freq_hz = int(freq_mhz * 1000000)
        # SX1262 formula: RF_reg = freq_hz / (32 MHz / 2^25)
        freq_reg = int((freq_hz * (2**25)) / 32000000)
        cmd = [
            OP_SET_RF_FREQUENCY,
            (freq_reg >> 24) & 0xFF,
            (freq_reg >> 16) & 0xFF,
            (freq_reg >> 8) & 0xFF,
            freq_reg & 0xFF
        ]
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2(cmd)

    def _set_pa_config(self, pa_duty_cycle: int = 0x04, hp_max: int = 0x07, device_sel: int = 0x00, pa_lut: int = 0x01):
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([OP_SET_PA_CONFIG, pa_duty_cycle, hp_max, device_sel, pa_lut])

    def _set_tx_params(self, power_dbm: int = 14, ramp_time: int = 0x02):
        self.tx_power_dbm = power_dbm
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([OP_SET_TX_PARAMS, power_dbm & 0xFF, ramp_time])

    def _set_buffer_base_address(self, tx_base: int = 0x00, rx_base: int = 0x00):
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([OP_SET_BUFFER_BASE_ADDRESS, tx_base, rx_base])

    def _set_modulation_params(self, sf: int, bw_khz: float = 125.0, cr: int = 1):
        self.spreading_factor = sf
        # SX1262 BW encoding: 125kHz -> 0x04, 250kHz -> 0x05, 500kHz -> 0x06
        bw_code = 0x04
        if bw_khz >= 500:
            bw_code = 0x06
        elif bw_khz >= 250:
            bw_code = 0x05

        ldro = 0x01 if (sf >= 11 and bw_khz <= 125.0) else 0x00
        cmd = [OP_SET_MODULATION_PARAMS, sf, bw_code, cr, ldro]
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2(cmd)

    def _set_packet_params(self, preamble_len: int = 8, header_type: int = 0, payload_len: int = 255, crc_on: int = 1, invert_iq: int = 0):
        cmd = [
            OP_SET_PACKET_PARAMS,
            (preamble_len >> 8) & 0xFF,
            preamble_len & 0xFF,
            header_type,
            payload_len,
            crc_on,
            invert_iq
        ]
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2(cmd)

    def _set_dio_irq_params(self, irq_mask: int, dio1_mask: int):
        cmd = [
            OP_SET_DIO_IRQ_PARAMS,
            (irq_mask >> 8) & 0xFF,
            irq_mask & 0xFF,
            (dio1_mask >> 8) & 0xFF,
            dio1_mask & 0xFF,
            0x00, 0x00, # DIO2
            0x00, 0x00  # DIO3
        ]
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2(cmd)

    def _set_rx(self, timeout: int = 0x000000):
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([
                OP_SET_RX,
                (timeout >> 16) & 0xFF,
                (timeout >> 8) & 0xFF,
                timeout & 0xFF
            ])

    def _get_irq_status(self) -> int:
        if not self.is_hardware_available:
            return 0
        self._wait_busy()
        res = self.spi.xfer2([OP_GET_IRQ_STATUS, 0x00, 0x00, 0x00])
        return (res[2] << 8) | res[3]

    def _clear_irq_status(self, mask: int = IRQ_ALL):
        if self.is_hardware_available:
            self._wait_busy()
            self.spi.xfer2([
                OP_CLEAR_IRQ_STATUS,
                (mask >> 8) & 0xFF,
                mask & 0xFF
            ])

    # =========================================================================
    # 8.2 Real RX Path
    # =========================================================================
    def receive_packet(self) -> Optional[bytes]:
        """
        Physical RX sequence:
        1. Check IRQ Status (via DIO1 or SPI GetIrqStatus)
        2. Detect IRQ_RX_DONE
        3. Check CRC error
        4. Read RX Buffer Status (GetRxBufferStatus -> payloadLen, rxStartBufferPointer)
        5. Read bytes from buffer (ReadBuffer)
        6. Clear IRQ status
        7. Re-enter continuous RX
        """
        if not self.is_hardware_available:
            # Fallback to virtual buffer for test harness
            if self._virtual_rx_queue:
                packet = self._virtual_rx_queue.pop(0)
                self.stats.rx_count += 1
                return packet
            return None

        irq = self._get_irq_status()
        if not (irq & IRQ_RX_DONE):
            return None

        # Check for CRC error flag from SX1262
        if irq & IRQ_CRC_ERROR:
            logger.warning("[SX1262-RX] Dropping packet with hardware CRC error")
            self.stats.rx_errors += 1
            self._clear_irq_status(IRQ_ALL)
            self._set_rx(0x000000)
            return None

        try:
            # Opcode 0x13: GetRxBufferStatus -> [status, rxPayloadLength, rxStartBufferPointer]
            self._wait_busy()
            status_res = self.spi.xfer2([OP_GET_RX_BUFFER_STATUS, 0x00, 0x00, 0x00])
            payload_len = status_res[2]
            start_pointer = status_res[3]

            if payload_len == 0:
                self._clear_irq_status(IRQ_ALL)
                self._set_rx(0x000000)
                return None

            # Opcode 0x1E: ReadBuffer -> [OP_READ_BUFFER, offset, NOP] + payload
            self._wait_busy()
            read_cmd = [OP_READ_BUFFER, start_pointer, 0x00] + [0x00] * payload_len
            buf_res = self.spi.xfer2(read_cmd)
            raw_bytes = bytes(buf_res[3:3+payload_len])

            # Read Packet Status (RSSI & SNR)
            self._wait_busy()
            pkt_status = self.spi.xfer2([OP_GET_PACKET_STATUS, 0x00, 0x00, 0x00, 0x00])
            rssi_val = -pkt_status[2] / 2.0
            snr_raw = pkt_status[3]
            snr_val = (snr_raw - 256 if snr_raw > 127 else snr_raw) / 4.0

            self.stats.last_rssi = rssi_val
            self.stats.last_snr = snr_val
            self.stats.rx_count += 1

            self._clear_irq_status(IRQ_ALL)
            self._set_rx(0x000000)

            logger.info(f"[SX1262-RX] Received {len(raw_bytes)} bytes (RSSI: {rssi_val:.1f} dBm, SNR: {snr_val:.1f} dB)")
            return raw_bytes

        except Exception as e:
            logger.error(f"[SX1262-RX] Error reading hardware buffer: {e}")
            self.stats.rx_errors += 1
            self._clear_irq_status(IRQ_ALL)
            self._set_rx(0x000000)
            return None

    # =========================================================================
    # 8.3 CAD / Collision Handling
    # =========================================================================
    def perform_cad(self) -> bool:
        """
        Physical Channel Activity Detection (CAD).
        Checks if the channel has active LoRa preambles or symbols.
        Returns:
            True: Channel is CLEAR for transmission.
            False: Channel is BUSY.
        """
        if not self.is_hardware_available:
            return True # Simulated channel clear

        self._set_standby(STDBY_RC)
        self._clear_irq_status(IRQ_ALL)

        # Set CAD Parameters: 4 symbols, peak det=22, min det=10, exit to STDBY_RC (0), timeout=0
        self._wait_busy()
        self.spi.xfer2([OP_SET_CAD_PARAMS, 0x02, 22, 10, 0x00, 0x00, 0x00, 0x00])

        # Trigger CAD
        self._wait_busy()
        self.spi.xfer2([OP_SET_CAD])

        # Poll for CAD_DONE (typically completes within 2 - 8 ms depending on SF)
        start = time.time()
        while time.time() - start < 0.05:
            irq = self._get_irq_status()
            if irq & IRQ_CAD_DONE:
                if irq & IRQ_CAD_DETECTED:
                    self.stats.cad_busy_count += 1
                    self._clear_irq_status(IRQ_ALL)
                    self._set_rx(0x000000)
                    return False # Channel BUSY
                else:
                    self._clear_irq_status(IRQ_ALL)
                    return True # Channel CLEAR
            time.sleep(0.001)

        self._clear_irq_status(IRQ_ALL)
        return True # Timeout assumed clear

    # =========================================================================
    # 8.4 Duty Cycle & Transmission Pipeline
    # =========================================================================
    def calculate_airtime_ms(self, payload_length: int) -> int:
        """
        Calculates theoretical airtime for Semtech LoRa packets.
        """
        tsym = (2 ** self.spreading_factor) / (self.bandwidth_khz * 1000)
        t_preamble = (8 + 4.25) * tsym

        de = 1 if (self.spreading_factor >= 11 and self.bandwidth_khz <= 125.0) else 0
        h = 0 # explicit header
        cr = self.coding_rate

        numerator = 8 * payload_length - 4 * self.spreading_factor + 28 + 16 - 20 * h
        denominator = 4 * (self.spreading_factor - 2 * de)
        n_payload = 8 + max(math.ceil(numerator / denominator) * (cr + 4), 0)

        t_payload = n_payload * tsym
        total_airtime_s = t_preamble + t_payload
        return max(10, int(total_airtime_s * 1000))

    def get_rolling_hour_airtime_ms(self) -> int:
        """
        Sums airtime consumed in the last 3600 seconds.
        Integrates with SQLite storage if configured.
        """
        cutoff = time.time() - 3600.0

        # Load from SQLite if available
        if self.duty_cycle_storage:
            try:
                records = self.duty_cycle_storage.get_airtime_window(cutoff)
                return sum(r["airtime_ms"] for r in records)
            except Exception:
                pass

        # In-memory window
        self._duty_cycle_history = [r for r in self._duty_cycle_history if r[0] >= cutoff]
        return sum(r[1] for r in self._duty_cycle_history)

    def is_duty_cycle_allowed(self, airtime_ms: int, priority: int = 1) -> bool:
        """
        Enforces ETSI EU868 1% duty cycle (36,000 ms per rolling hour) with priority awareness:
        - Priority 3 (EMERGENCY/SOS): Allowed up to hard 36,000 ms limit.
        - Priority 2 (ACK/DIRECT): Allowed up to 80% quota (28,800 ms).
        - Priority 1 (NORMAL): Allowed up to 50% quota (18,000 ms).
        - Priority 0 (TELEMETRY): Allowed up to 30% quota (10,800 ms).
        """
        used_ms = self.get_rolling_hour_airtime_ms()
        quota_ms = 36000 # 1% of 3600s

        if priority >= 3:
            threshold = quota_ms
        elif priority == 2:
            threshold = int(quota_ms * 0.8)
        elif priority == 1:
            threshold = int(quota_ms * 0.5)
        else:
            threshold = int(quota_ms * 0.3)

        return (used_ms + airtime_ms) <= threshold

    def transmit(self, data: bytes, priority: int = 1) -> bool:
        """
        Full hardware transmission sequence:
        1. Duty cycle validation
        2. Physical CAD check with exponential backoff (8.3)
        3. Write to SX1262 hardware buffer
        4. Trigger SetTx
        5. Await TxDone IRQ
        6. Record airtime in persistent accounting (8.4)
        7. Return to continuous RX
        """
        airtime_ms = self.calculate_airtime_ms(len(data))

        # Check duty cycle
        if not self.is_duty_cycle_allowed(airtime_ms, priority):
            logger.warning(f"[SX1262-TX] Duty cycle limit exceeded for priority {priority}. Dropping frame.")
            self.stats.tx_errors += 1
            return False

        # CAD Collision Handling with randomized slot backoff (8.3)
        cad_attempts = 0
        max_cad_attempts = 4
        while cad_attempts < max_cad_attempts:
            if self.perform_cad():
                break # Channel clear!
            cad_attempts += 1
            # Physical slot backoff: random 5ms - 20ms * attempt
            backoff_s = random.uniform(0.005, 0.02) * (2 ** cad_attempts)
            time.sleep(backoff_s)

        if cad_attempts >= max_cad_attempts:
            logger.warning("[SX1262-TX] Channel constantly busy during CAD. Backing off.")
            self.stats.tx_errors += 1
            return False

        # Physical Transmission
        if self.is_hardware_available:
            try:
                self._set_standby(STDBY_RC)
                # Set payload length in packet params
                self._set_packet_params(preamble_len=8, header_type=0, payload_len=len(data), crc_on=1, invert_iq=0)

                # Reset buffer pointer and write payload
                self._set_buffer_base_address(tx_base=0x00, rx_base=0x00)
                self._wait_busy()
                self.spi.xfer2([OP_WRITE_BUFFER, 0x00] + list(data))

                # Clear IRQs and trigger TX (timeout 0 = infinite)
                self._clear_irq_status(IRQ_ALL)
                self._wait_busy()
                self.spi.xfer2([OP_SET_TX, 0x00, 0x00, 0x00])

                # Wait for TxDone
                start_tx = time.time()
                timeout_s = (airtime_ms / 1000.0) + 0.1
                tx_success = False

                while time.time() - start_tx < timeout_s:
                    irq = self._get_irq_status()
                    if irq & IRQ_TX_DONE:
                        tx_success = True
                        break
                    time.sleep(0.002)

                self._clear_irq_status(IRQ_ALL)
                self._set_rx(0x000000)

                if not tx_success:
                    logger.error("[SX1262-TX] TxDone timeout on hardware SPI")
                    self.stats.tx_errors += 1
                    return False

            except Exception as e:
                logger.error(f"[SX1262-TX] Hardware transmission failed: {e}")
                self.stats.tx_errors += 1
                return False

        # Record airtime accounting (8.4)
        now = time.time()
        self._duty_cycle_history.append((now, airtime_ms, priority))
        if self.duty_cycle_storage:
            try:
                self.duty_cycle_storage.record_airtime(now, airtime_ms, priority)
            except Exception:
                pass

        self.stats.tx_count += 1
        self.stats.airtime_ms_total += airtime_ms
        logger.info(f"[SX1262-TX] Transmitted {len(data)} bytes (Airtime: {airtime_ms}ms, Priority: {priority})")
        return True

    def inject_simulated_rx(self, packet: bytes):
        """Used by integration test harness to verify RX unpacking."""
        self._virtual_rx_queue.append(packet)

    def get_stats(self) -> Dict[str, Any]:
        used_ms = self.get_rolling_hour_airtime_ms()
        return {
            "hardware_available": self.is_hardware_available,
            "frequency_mhz": self.frequency_mhz,
            "bandwidth_khz": self.bandwidth_khz,
            "spreading_factor": self.spreading_factor,
            "tx_power_dbm": self.tx_power_dbm,
            "tx_count": self.stats.tx_count,
            "rx_count": self.stats.rx_count,
            "tx_errors": self.stats.tx_errors,
            "rx_errors": self.stats.rx_errors,
            "last_rssi": self.stats.last_rssi,
            "last_snr": self.stats.last_snr,
            "cad_busy_count": self.stats.cad_busy_count,
            "rolling_hour_airtime_ms": used_ms,
            "duty_cycle_percent": round((used_ms / 3600000.0) * 100, 3),
        }

    def is_available(self) -> bool:
        return self.is_hardware_available
