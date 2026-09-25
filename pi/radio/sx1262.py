"""
Hardware Driver for Semtech SX1262 LoRa Transceiver via SPI & GPIO on Raspberry Pi Zero 2 W

Features:
- Event-driven DIO1 IRQ handling & background packet worker
- Low-latency hardware BUSY synchronization (tight spin with progressive backoff)
- Physically grounded symbol duration Tsym = 2^SF / BW and LDRO policy
- Exact Semtech LoRa Time-on-Air (ToA) calculation and priority-aware duty-cycle tracking
- Unified BaseRadio contract (start, stop, transmit, receive, cad, get_stats, get_capabilities)
"""

import time
import math
import random
import logging
import threading
import queue
from typing import Optional, Tuple, Dict, Any, List, Callable
from .base import BaseRadio, RadioStats
from .profile import DEFAULT_RADIO_PROFILE, RadioRegionPolicy
from .airtime import (
    calculate_lora_airtime_ms,
    is_ldro_required,
    get_symbol_duration_ms
)

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
        frequency_mhz: float = DEFAULT_RADIO_PROFILE.default_channel.frequency_mhz,
        bandwidth_khz: float = DEFAULT_RADIO_PROFILE.default_channel.bandwidth_khz,
        spreading_factor: int = DEFAULT_RADIO_PROFILE.default_channel.spreading_factor,
        coding_rate: int = DEFAULT_RADIO_PROFILE.default_channel.coding_rate,
        tx_power_dbm: int = DEFAULT_RADIO_PROFILE.default_channel.tx_power_dbm,
        duty_cycle_storage = None,
        profile: RadioRegionPolicy = DEFAULT_RADIO_PROFILE
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
        self.profile = profile

        self.spi = None
        self.gpio = None
        self.is_hardware_available = False

        self.stats = RadioStats()
        self.duty_cycle_storage = duty_cycle_storage
        self._duty_cycle_history: List[Tuple[float, int, int]] = [] # (timestamp, airtime_ms, priority)

        # Event-driven threading primitives
        self._dio1_event = threading.Event()
        self._tx_done_event = threading.Event()
        self._cad_done_event = threading.Event()
        self._cad_busy_detected = False
        self._rx_packet_queue: queue.Queue = queue.Queue()
        self._virtual_rx_queue: List[bytes] = []

        self._irq_worker_thread: Optional[threading.Thread] = None
        self._running = False
        self._on_packet_cb: Optional[Callable[[bytes, float, float], None]] = None

    # =========================================================================
    # BaseRadio Lifecycle
    # =========================================================================
    def start(self) -> bool:
        """Initializes hardware and starts event-driven IRQ worker thread."""
        success = self.init_hardware()
        if success:
            self._running = True
            self._irq_worker_thread = threading.Thread(
                target=self._event_irq_worker,
                name="SX1262-IRQ-Worker",
                daemon=True
            )
            self._irq_worker_thread.start()
        return success

    def stop(self) -> None:
        """Powers down radio and terminates event worker."""
        self._running = False
        self._dio1_event.set()
        if self.is_hardware_available:
            try:
                self._set_standby(STDBY_RC)
            except Exception:
                pass
        if self.gpio:
            try:
                self.gpio.remove_event_detect(self.dio1_pin)
            except Exception:
                pass

    # =========================================================================
    # Hardware Initialization
    # =========================================================================
    def init_hardware(self) -> bool:
        """
        Full 10-step SX1262 hardware initialization sequence with physical LDRO.
        """
        try:
            import spidev
            import RPi.GPIO as GPIO

            self.gpio = GPIO
            self.gpio.setmode(GPIO.BCM)
            self.gpio.setup(self.reset_pin, GPIO.OUT)
            self.gpio.setup(self.busy_pin, GPIO.IN)
            self.gpio.setup(self.dio1_pin, GPIO.IN)

            # Register hardware rising-edge interrupt on DIO1 for zero-polling event loop
            try:
                self.gpio.add_event_detect(
                    self.dio1_pin,
                    GPIO.RISING,
                    callback=self._on_dio1_interrupt,
                    bouncetime=1
                )
            except Exception as irq_err:
                logger.warning(f"Could not bind GPIO edge event for DIO1: {irq_err}")

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

            # Step 8: Modulation Params (SF, BW, CR, physical LDRO check)
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

    # =========================================================================
    # Hardware Synchronization: BUSY Pin
    # =========================================================================
    def _wait_busy(self, timeout_s: float = 0.05):
        """
        Field-grade hardware synchronization on SX1262 BUSY line.
        Avoids arbitrary blocking sleeps: first performs tight spin-checks (typical BUSY
        transition is only 30-100 microseconds), then yields to kernel with micro-sleeps.
        """
        if not self.gpio or not self.is_hardware_available:
            return

        # Fast spin path for sub-millisecond command execution
        for _ in range(80):
            if self.gpio.input(self.busy_pin) == 0:
                return

        # Progressive yielding path if chip is doing PLL lock or calibration
        start = time.time()
        while self.gpio.input(self.busy_pin) == 1:
            if time.time() - start > timeout_s:
                logger.warning(f"SX1262 BUSY line hold timeout (> {timeout_s * 1000:.1f}ms)")
                break
            time.sleep(0.0001)

    def _reset(self):
        if self.gpio:
            self.gpio.output(self.reset_pin, self.gpio.LOW)
            time.sleep(0.001)
            self.gpio.output(self.reset_pin, self.gpio.HIGH)
            time.sleep(0.002)
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
        """
        Configures modulation params.
        Enables LDRO based on physical symbol duration Tsym >= 16.0 ms, not an arbitrary heuristic.
        """
        self.spreading_factor = sf
        self.bandwidth_khz = bw_khz
        self.coding_rate = cr

        bw_code = 0x04
        if bw_khz >= 500:
            bw_code = 0x06
        elif bw_khz >= 250:
            bw_code = 0x05

        ldro = 0x01 if is_ldro_required(sf, bw_khz) else 0x00
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
    # Event-Driven DIO1 IRQ Architecture
    # =========================================================================
    def _on_dio1_interrupt(self, _channel: int):
        """GPIO edge interrupt handler: immediately awakens background worker."""
        self._dio1_event.set()

    def _event_irq_worker(self):
        """
        Background worker thread: processes DIO1 IRQs asynchronously.
        Flow: DIO1 IRQ -> Event -> Worker -> GetIrqStatus -> ReadBuffer -> Queue.
        """
        while self._running:
            signaled = self._dio1_event.wait(timeout=0.2)
            if not self._running:
                break
            if not signaled:
                continue

            self._dio1_event.clear()
            self._process_hardware_irqs()

    def _process_hardware_irqs(self):
        """Reads and handles active hardware IRQ flags."""
        if not self.is_hardware_available:
            return

        irq = self._get_irq_status()
        if irq == 0:
            return

        # 1. TX Done
        if irq & IRQ_TX_DONE:
            self._tx_done_event.set()

        # 2. CAD Done
        if irq & IRQ_CAD_DONE:
            self._cad_busy_detected = bool(irq & IRQ_CAD_DETECTED)
            self._cad_done_event.set()

        # 3. RX Done
        if irq & IRQ_RX_DONE:
            if irq & IRQ_CRC_ERROR:
                logger.warning("[SX1262-RX] Dropping packet with hardware CRC error")
                self.stats.rx_errors += 1
            else:
                self._read_and_enqueue_rx()

        # Clear processed IRQ flags and return to RX
        self._clear_irq_status(IRQ_ALL)
        if not (irq & IRQ_TX_DONE):
            self._set_rx(0x000000)

    def _read_and_enqueue_rx(self):
        """Fetches payload bytes and signal status from SX1262 internal memory."""
        try:
            self._wait_busy()
            status_res = self.spi.xfer2([OP_GET_RX_BUFFER_STATUS, 0x00, 0x00, 0x00])
            payload_len = status_res[2]
            start_pointer = status_res[3]

            if payload_len == 0:
                return

            self._wait_busy()
            read_cmd = [OP_READ_BUFFER, start_pointer, 0x00] + [0x00] * payload_len
            buf_res = self.spi.xfer2(read_cmd)
            raw_bytes = bytes(buf_res[3:3+payload_len])

            self._wait_busy()
            pkt_status = self.spi.xfer2([OP_GET_PACKET_STATUS, 0x00, 0x00, 0x00, 0x00])
            rssi_val = -pkt_status[2] / 2.0
            snr_raw = pkt_status[3]
            snr_val = (snr_raw - 256 if snr_raw > 127 else snr_raw) / 4.0

            self.stats.last_rssi = rssi_val
            self.stats.last_snr = snr_val
            self.stats.rx_count += 1

            self._rx_packet_queue.put(raw_bytes)

            if self._on_packet_cb:
                try:
                    self._on_packet_cb(raw_bytes, rssi_val, snr_val)
                except Exception as cb_err:
                    logger.error(f"[SX1262] on_packet callback error: {cb_err}")

        except Exception as e:
            logger.error(f"[SX1262-RX] Error reading hardware buffer: {e}")
            self.stats.rx_errors += 1

    # =========================================================================
    # Unified Receive API
    # =========================================================================
    def receive(self, timeout_s: float = 0.0) -> Optional[bytes]:
        """
        Receives next frame from event queue.
        Supports both hardware queue and virtual queue for testing.
        """
        # If virtual test frames exist, return them
        if self._virtual_rx_queue:
            pkt = self._virtual_rx_queue.pop(0)
            self.stats.rx_count += 1
            return pkt

        # If hardware is available but worker thread is not started (e.g. direct synchronous test)
        if self.is_hardware_available and not self._running:
            irq = self._get_irq_status()
            if irq & IRQ_RX_DONE:
                self._process_hardware_irqs()

        try:
            if timeout_s > 0:
                return self._rx_packet_queue.get(timeout=timeout_s)
            else:
                return self._rx_packet_queue.get_nowait()
        except queue.Empty:
            return None

    # =========================================================================
    # Channel Activity Detection (CAD)
    # =========================================================================
    def cad(self) -> bool:
        """
        Performs physical Channel Activity Detection (CAD).
        Uses Semtech SX1261/SX1262 datasheet configuration.
        Returns:
            True: Channel is CLEAR for transmission.
            False: Channel is BUSY.
        """
        if not self.is_hardware_available:
            return True # Simulated channel clear

        self._set_standby(STDBY_RC)
        self._clear_irq_status(IRQ_ALL)

        # Set CAD Parameters based on Semtech SX1261/SX1262 AN1200.48 / profile
        cad_sym_code = 0x02 if self.profile.cad_symbol_num == 4 else (0x01 if self.profile.cad_symbol_num == 2 else 0x00)
        det_peak = self.profile.cad_det_peak
        det_min = self.profile.cad_det_min
        self._wait_busy()
        self.spi.xfer2([OP_SET_CAD_PARAMS, cad_sym_code, det_peak, det_min, 0x00, 0x00, 0x00, 0x00])

        self._cad_done_event.clear()
        self._cad_busy_detected = False

        # Trigger CAD
        self._wait_busy()
        self.spi.xfer2([OP_SET_CAD])

        # Poll or wait for CAD_DONE
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
                    self._set_rx(0x000000)
                    return True # Channel CLEAR
            time.sleep(0.001)

        self._clear_irq_status(IRQ_ALL)
        self._set_rx(0x000000)
        return True # Assumed clear on timeout

    # =========================================================================
    # Duty Cycle & Transmission Pipeline
    # =========================================================================
    def calculate_airtime_ms(self, payload_length: int) -> int:
        """Calculates exact physical Time-on-Air based on modulation physics."""
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
        if self.duty_cycle_storage:
            try:
                records = self.duty_cycle_storage.get_airtime_window(cutoff)
                return sum(r["airtime_ms"] for r in records)
            except Exception:
                pass

        self._duty_cycle_history = [r for r in self._duty_cycle_history if r[0] >= cutoff]
        return sum(r[1] for r in self._duty_cycle_history)

    def is_duty_cycle_allowed(self, airtime_ms: int, priority: int = 1) -> bool:
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
        2. Physical CAD check with exponential backoff
        3. Write to SX1262 hardware buffer
        4. Trigger SetTx
        5. Wait for TxDone
        6. Record real airtime in accounting
        7. Return to continuous RX
        """
        airtime_ms = self.calculate_airtime_ms(len(data))

        # Check duty cycle
        if not self.is_duty_cycle_allowed(airtime_ms, priority):
            logger.warning(f"[SX1262-TX] Duty cycle limit exceeded for priority {priority}. Dropping frame.")
            self.stats.tx_errors += 1
            return False

        # CAD Collision Handling with randomized slot backoff
        cad_attempts = 0
        max_cad_attempts = 4
        while cad_attempts < max_cad_attempts:
            if self.cad():
                break # Channel clear!
            cad_attempts += 1
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
                self._set_packet_params(preamble_len=8, header_type=0, payload_len=len(data), crc_on=1, invert_iq=0)
                self._set_buffer_base_address(tx_base=0x00, rx_base=0x00)
                self._wait_busy()
                self.spi.xfer2([OP_WRITE_BUFFER, 0x00] + list(data))

                self._clear_irq_status(IRQ_ALL)
                self._tx_done_event.clear()
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
                    time.sleep(0.001)

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

        # Record airtime accounting
        now = time.time()
        self._duty_cycle_history.append((now, airtime_ms, priority))
        if self.duty_cycle_storage:
            try:
                self.duty_cycle_storage.record_airtime(now, airtime_ms, priority)
            except Exception:
                pass

        self.stats.tx_count += 1
        self.stats.airtime_ms_total += airtime_ms
        self.stats.total_airtime_ms += airtime_ms
        logger.info(f"[SX1262-TX] Transmitted {len(data)} bytes (Airtime: {airtime_ms}ms, Priority: {priority})")
        return True

    def inject_simulated_rx(self, packet: bytes):
        """Used by test harness to verify RX unpacking."""
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

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "driver": "SX1262Driver",
            "frequency_mhz": self.frequency_mhz,
            "spreading_factor": self.spreading_factor,
            "bandwidth_khz": self.bandwidth_khz,
            "ldro_enabled": is_ldro_required(self.spreading_factor, self.bandwidth_khz),
            "symbol_duration_ms": get_symbol_duration_ms(self.spreading_factor, self.bandwidth_khz),
            "event_driven_dio1": True,
            "cad_supported": True,
        }

    def is_available(self) -> bool:
        return self.is_hardware_available
