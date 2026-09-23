"""
Hardware Driver for Semtech SX1262 LoRa Transceiver via SPI & GPIO on Raspberry Pi Zero 2 W
"""

import time
import logging

logger = logging.getLogger("hoimu.sx1262")

class SX1262Driver:
    # SX1262 Command OpCodes
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
    OP_WRITE_BUFFER = 0x0E
    OP_READ_BUFFER = 0x1E
    OP_GET_PACKET_STATUS = 0x14

    def __init__(self, spi_bus=0, spi_device=0, reset_pin=18, busy_pin=24, dio1_pin=23):
        self.spi_bus = spi_bus
        self.spi_device = spi_device
        self.reset_pin = reset_pin
        self.busy_pin = busy_pin
        self.dio1_pin = dio1_pin
        self.is_hardware_available = False
        self.frequency_mhz = 868.0  # EU868 ISM band
        self.bandwidth_khz = 125.0
        self.spreading_factor = 7
        self.tx_power_dbm = 14

    def init_hardware(self):
        try:
            import spidev
            import RPi.GPIO as GPIO
            
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.reset_pin, GPIO.OUT)
            GPIO.setup(self.busy_pin, GPIO.IN)
            GPIO.setup(self.dio1_pin, GPIO.IN)

            self.spi = spidev.SpiDev()
            self.spi.open(self.spi_bus, self.spi_device)
            self.spi.max_speed_hz = 2000000
            self.spi.mode = 0

            self._reset()
            self._set_standby()
            self._set_frequency(self.frequency_mhz)
            self._set_lora_modulation()
            self.is_hardware_available = True
            logger.info("SX1262 LoRa Hardware initialized successfully on EU868")
            return True
        except Exception as e:
            logger.warning(f"Hardware SX1262 SPI unavailable ({e}). Falling back to virtual software transceiver.")
            self.is_hardware_available = False
            return False

    def _reset(self):
        try:
            import RPi.GPIO as GPIO
            GPIO.output(self.reset_pin, GPIO.LOW)
            time.sleep(0.01)
            GPIO.output(self.reset_pin, GPIO.HIGH)
            time.sleep(0.02)
        except:
            pass

    def _set_standby(self):
        if self.is_hardware_available:
            self.spi.xfer2([self.OP_SET_STANDBY, 0x00])

    def _set_frequency(self, freq_mhz: float):
        self.frequency_mhz = freq_mhz
        freq_hz = int(freq_mhz * 1000000)
        freq_reg = int(freq_hz / (32000000.0 / (2**25)))
        cmd = [
            self.OP_SET_RF_FREQUENCY,
            (freq_reg >> 24) & 0xFF,
            (freq_reg >> 16) & 0xFF,
            (freq_reg >> 8) & 0xFF,
            freq_reg & 0xFF
        ]
        if self.is_hardware_available:
            self.spi.xfer2(cmd)

    def _set_lora_modulation(self):
        # Spreading factor 7, Bandwidth 125kHz, Coding Rate 4/5
        cmd = [self.OP_SET_MODULATION_PARAMS, self.spreading_factor, 0x04, 0x01, 0x00]
        if self.is_hardware_available:
            self.spi.xfer2(cmd)

    def transmit(self, data: bytes) -> bool:
        logger.info(f"[SX1262-TX] Transmitting {len(data)} bytes over LoRa {self.frequency_mhz} MHz")
        if self.is_hardware_available:
            try:
                self._set_standby()
                # Write to SX1262 buffer
                self.spi.xfer2([self.OP_SET_BUFFER_BASE_ADDRESS, 0x00, 0x00])
                self.spi.xfer2([self.OP_WRITE_BUFFER, 0x00] + list(data))
                # Trigger TX
                self.spi.xfer2([self.OP_SET_TX, 0x00, 0x00, 0x00])
                time.sleep(0.05) # wait for airtime
                return True
            except Exception as e:
                logger.error(f"TX error: {e}")
                return False
        return True

    def receive_packet(self):
        # Polls packet if available
        return None
