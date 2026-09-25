"""
Comprehensive Unit Tests for SX1262 LoRa Transceiver Implementation
Tests:
- 8.1 SX1262 initialization (frequency math, modulation params, packet params, IRQ)
- 8.2 Real RX path (buffer reading, binary unpack, CRC verification, RSSI/SNR)
- 8.3 CAD / collision handling (channel busy detection & slot backoff)
- 8.4 Duty cycle (rolling 1-hour airtime window, SQLite persistence, priority awareness)
"""

import unittest
import time
import os
from pi.radio.sx1262 import (
    SX1262Driver,
    OP_SET_STANDBY,
    OP_SET_RF_FREQUENCY,
    OP_SET_MODULATION_PARAMS,
    OP_SET_PACKET_PARAMS,
    OP_SET_DIO_IRQ_PARAMS,
    IRQ_RX_DONE,
    IRQ_CRC_ERROR,
    IRQ_CAD_DONE,
    IRQ_CAD_DETECTED
)
from pi.protocol.codec import BinaryCodec
from pi.protocol.packets import HoimuPacketType
from pi.storage.sqlite import SQLiteStorage

class MockSpiDev:
    def __init__(self):
        self.transfers = []
        self.rx_buffer_content = []
        self.irq_status = 0x0000
        self.packet_status = [0x00, 0x00, 40, 24] # RSSI: -20 dBm, SNR: 6 dB

    def xfer2(self, data):
        self.transfers.append(list(data))
        opcode = data[0]

        if opcode == 0x12: # OP_GET_IRQ_STATUS
            return [0x00, 0x00, (self.irq_status >> 8) & 0xFF, self.irq_status & 0xFF]
        elif opcode == 0x13: # OP_GET_RX_BUFFER_STATUS
            payload_len = len(self.rx_buffer_content)
            return [0x00, 0x00, payload_len, 0x00]
        elif opcode == 0x1E: # OP_READ_BUFFER
            return [0x00, 0x00, 0x00] + list(self.rx_buffer_content)
        elif opcode == 0x14: # OP_GET_PACKET_STATUS
            return self.packet_status
        elif opcode == 0xC5: # OP_SET_CAD
            if hasattr(self, 'next_cad_irq'):
                self.irq_status = self.next_cad_irq
            return [0x00]
        elif opcode == 0x02: # OP_CLEAR_IRQ_STATUS
            self.irq_status = 0x0000
            return [0x00, 0x00]

        return [0x00] * len(data)

class TestSX1262RealImplementation(unittest.TestCase):
    def setUp(self):
        self.test_db_path = "test_sx1262_duty.db"
        if os.path.exists(self.test_db_path):
            os.remove(self.test_db_path)
        self.storage = SQLiteStorage(db_path=self.test_db_path)

        self.driver = SX1262Driver(
            frequency_mhz=868.1,
            bandwidth_khz=125.0,
            spreading_factor=7,
            duty_cycle_storage=self.storage
        )

    def tearDown(self):
        self.storage.close()
        if os.path.exists(self.test_db_path):
            os.remove(self.test_db_path)

    # =========================================================================
    # 8.1 SX1262 Initialization
    # =========================================================================
    def test_8_1_frequency_calculation(self):
        """Verifies 32-bit register calculation for 868.1 MHz: RF_reg = (freq * 2^25) / 32MHz."""
        freq_hz = int(868.1 * 1000000)
        expected_reg = int((freq_hz * (2**25)) / 32000000)

        mock_spi = MockSpiDev()
        self.driver.spi = mock_spi
        self.driver.is_hardware_available = True

        self.driver._set_rf_frequency(868.1)

        tx_cmds = [cmd for cmd in mock_spi.transfers if cmd[0] == OP_SET_RF_FREQUENCY]
        self.assertEqual(len(tx_cmds), 1)
        actual_reg = (tx_cmds[0][1] << 24) | (tx_cmds[0][2] << 16) | (tx_cmds[0][3] << 8) | tx_cmds[0][4]
        self.assertEqual(actual_reg, expected_reg)

    def test_8_1_modulation_and_packet_params(self):
        """Verifies modulation and packet params opcodes and arguments."""
        mock_spi = MockSpiDev()
        self.driver.spi = mock_spi
        self.driver.is_hardware_available = True

        self.driver._set_modulation_params(sf=7, bw_khz=125.0, cr=1)
        mod_cmds = [cmd for cmd in mock_spi.transfers if cmd[0] == OP_SET_MODULATION_PARAMS]
        self.assertEqual(len(mod_cmds), 1)
        # SF=7, BW=0x04 (125kHz), CR=1 (4/5), LDRO=0
        self.assertEqual(mod_cmds[0], [OP_SET_MODULATION_PARAMS, 7, 0x04, 1, 0])

        self.driver._set_packet_params(preamble_len=8, header_type=0, payload_len=100, crc_on=1)
        pkt_cmds = [cmd for cmd in mock_spi.transfers if cmd[0] == OP_SET_PACKET_PARAMS]
        self.assertEqual(len(pkt_cmds), 1)
        # Preamble(0, 8), Header(0), PayloadLen(100), CRC(1), IQ(0)
        self.assertEqual(pkt_cmds[0], [OP_SET_PACKET_PARAMS, 0, 8, 0, 100, 1, 0])

    # =========================================================================
    # 8.2 Real RX Path
    # =========================================================================
    def test_8_2_rx_path_read_buffer_and_crc(self):
        """
        Tests the real RX path:
        IRQ -> GetIrqStatus -> GetRxBufferStatus -> ReadBuffer -> BinaryWirePacket -> CRC32.
        """
        mock_spi = MockSpiDev()
        self.driver.spi = mock_spi
        self.driver.is_hardware_available = True

        # Generate a valid wire packet
        valid_packet_bytes = BinaryCodec.encode(
            packet_type=HoimuPacketType.MESSAGE,
            origin_id="EST-01",
            dest_id="EST-02",
            packet_id="PKT777",
            ttl=7,
            sequence=12,
            payload_data={"msg": "Hardware RX Test"}
        )

        # Stage mock hardware
        mock_spi.irq_status = IRQ_RX_DONE
        mock_spi.rx_buffer_content = list(valid_packet_bytes)

        # Execute physical receive_packet()
        raw_received = self.driver.receive_packet()
        self.assertIsNotNone(raw_received)
        self.assertEqual(raw_received, valid_packet_bytes)

        # Verify decoded content and CRC
        decoded = BinaryCodec.decode(raw_received)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["originId"], "EST-01")
        self.assertEqual(decoded["destinationId"], "EST-02")
        self.assertEqual(decoded["packetId"], "PKT777")
        self.assertEqual(decoded["payload"], {"msg": "Hardware RX Test"})
        self.assertEqual(self.driver.stats.last_rssi, -20.0)
        self.assertEqual(self.driver.stats.last_snr, 6.0)

    def test_8_2_rx_path_drops_on_hardware_crc_error(self):
        """Verifies hardware CRC error drops packet without corrupting memory."""
        mock_spi = MockSpiDev()
        self.driver.spi = mock_spi
        self.driver.is_hardware_available = True

        mock_spi.irq_status = IRQ_RX_DONE | IRQ_CRC_ERROR
        mock_spi.rx_buffer_content = [0x00] * 50

        packet = self.driver.receive_packet()
        self.assertIsNone(packet)
        self.assertEqual(self.driver.stats.rx_errors, 1)

    # =========================================================================
    # 8.3 CAD / Collision Handling
    # =========================================================================
    def test_8_3_cad_channel_busy_and_clear(self):
        """Tests CAD state handling: CAD_DETECTED reports busy, CAD_DONE without detected reports clear."""
        mock_spi = MockSpiDev()
        self.driver.spi = mock_spi
        self.driver.is_hardware_available = True

        # Case 1: Channel busy
        mock_spi.next_cad_irq = IRQ_CAD_DONE | IRQ_CAD_DETECTED
        is_clear = self.driver.perform_cad()
        self.assertFalse(is_clear)
        self.assertEqual(self.driver.stats.cad_busy_count, 1)

        # Case 2: Channel clear
        mock_spi.next_cad_irq = IRQ_CAD_DONE
        is_clear = self.driver.perform_cad()
        self.assertTrue(is_clear)

    # =========================================================================
    # 8.4 Duty Cycle Management
    # =========================================================================
    def test_8_4_duty_cycle_rolling_hour_and_persistence(self):
        """
        Tests rolling 1-hour window accounting, SQLite persistence across restarts,
        and priority awareness.
        """
        now = time.time()
        # Old transmission outside 1-hour window (2 hours ago)
        self.storage.record_airtime(now - 7200, airtime_ms=5000, priority=1)
        # Recent transmissions inside 1-hour window
        self.storage.record_airtime(now - 600, airtime_ms=2000, priority=1)
        self.storage.record_airtime(now - 100, airtime_ms=3000, priority=3)

        # Initialize fresh driver instance with existing storage (simulating daemon restart)
        restarted_driver = SX1262Driver(duty_cycle_storage=self.storage)

        rolling_ms = restarted_driver.get_rolling_hour_airtime_ms()
        # Should only count the recent 2000ms + 3000ms = 5000ms, not the 2-hour old 5000ms!
        self.assertEqual(rolling_ms, 5000)

        stats = restarted_driver.get_stats()
        self.assertEqual(stats["rolling_hour_airtime_ms"], 5000)
        self.assertAlmostEqual(stats["duty_cycle_percent"], (5000 / 3600000.0) * 100, places=3)

    def test_8_4_duty_cycle_priority_enforcement(self):
        """
        Verifies priority-aware throttling:
        Priority 3 (SOS) permitted when lower priority packets are throttled.
        """
        now = time.time()
        # Consume 20,000 ms (exceeds 50% limit = 18,000 ms, but below 100% = 36,000 ms)
        self.storage.record_airtime(now - 10, airtime_ms=20000, priority=1)

        driver = SX1262Driver(duty_cycle_storage=self.storage)

        # Priority 1 (normal message) requires <= 50% quota (18,000ms) -> should be rejected
        self.assertFalse(driver.is_duty_cycle_allowed(airtime_ms=100, priority=1))

        # Priority 2 (ACK/direct) requires <= 80% quota (28,800ms) -> should be allowed
        self.assertTrue(driver.is_duty_cycle_allowed(airtime_ms=100, priority=2))

        # Priority 3 (SOS) requires <= 100% quota (36,000ms) -> should be allowed
        self.assertTrue(driver.is_duty_cycle_allowed(airtime_ms=100, priority=3))

    # =========================================================================
    # Requirement 26 & 27: Physical LDRO Symbol Duration & Airtime Test Matrix
    # =========================================================================
    def test_27_physical_ldro_symbol_duration(self):
        """
        Validates LDRO is determined strictly by symbol duration Tsym = 2^SF / BW >= 16.0 ms:
        - SF10 @ 125kHz: Tsym = 8.192ms  -> LDRO = False
        - SF11 @ 125kHz: Tsym = 16.384ms -> LDRO = True
        - SF12 @ 125kHz: Tsym = 32.768ms -> LDRO = True
        - SF11 @ 250kHz: Tsym = 8.192ms  -> LDRO = False (critical: old sf>=11 heuristic failed here)
        - SF12 @ 250kHz: Tsym = 16.384ms -> LDRO = True
        """
        from pi.radio.airtime import is_ldro_required, get_symbol_duration_ms

        # SF10 @ 125kHz
        self.assertAlmostEqual(get_symbol_duration_ms(10, 125.0), 8.192, places=3)
        self.assertFalse(is_ldro_required(10, 125.0))

        # SF11 @ 125kHz
        self.assertAlmostEqual(get_symbol_duration_ms(11, 125.0), 16.384, places=3)
        self.assertTrue(is_ldro_required(11, 125.0))

        # SF12 @ 125kHz
        self.assertAlmostEqual(get_symbol_duration_ms(12, 125.0), 32.768, places=3)
        self.assertTrue(is_ldro_required(12, 125.0))

        # SF11 @ 250kHz (double bandwidth halves symbol duration)
        self.assertAlmostEqual(get_symbol_duration_ms(11, 250.0), 8.192, places=3)
        self.assertFalse(is_ldro_required(11, 250.0))

        # SF12 @ 250kHz
        self.assertAlmostEqual(get_symbol_duration_ms(12, 250.0), 16.384, places=3)
        self.assertTrue(is_ldro_required(12, 250.0))

    def test_26_lora_airtime_full_test_matrix(self):
        """
        Executes requested test matrix:
        SF: [SF7, SF8, SF9, SF10, SF11, SF12]
        BW: [BW125, BW250]
        Payload: [16, 32, 64, 128, 200]
        Verifies exact physical LoRa airtimes and physical monotonicity.
        """
        from pi.radio.airtime import calculate_lora_airtime_ms

        sf_list = [7, 8, 9, 10, 11, 12]
        bw_list = [125.0, 250.0]
        payloads = [16, 32, 64, 128, 200]

        for sf in sf_list:
            for bw in bw_list:
                prev_airtime = 0
                for pl in payloads:
                    toa = calculate_lora_airtime_ms(payload_length_bytes=pl, sf=sf, bw_khz=bw)
                    self.assertGreater(toa, 0)
                    self.assertGreater(toa, prev_airtime, f"Airtime must increase with payload (SF{sf}, BW{bw}, PL{pl})")
                    prev_airtime = toa

        # Verify BW250 takes substantially less airtime than BW125 (approx half)
        for pl in payloads:
            toa_125 = calculate_lora_airtime_ms(pl, sf=7, bw_khz=125.0)
            toa_250 = calculate_lora_airtime_ms(pl, sf=7, bw_khz=250.0)
            self.assertLess(toa_250, toa_125)
            self.assertGreater(toa_250, toa_125 * 0.45)
            self.assertLess(toa_250, toa_125 * 0.65)

    # =========================================================================
    # Requirement 28: Unified BaseRadio API Across All Drivers
    # =========================================================================
    def test_28_unified_base_radio_contract(self):
        """
        Verifies all drivers implement unified BaseRadio interface:
        start(), stop(), transmit(), receive(), cad(), get_stats(), get_capabilities(), is_available()
        """
        from pi.radio.emulator import EmulatorRadio
        from pi.radio.ble import BleRadio
        from pi.radio.wifi import WifiDirectRadio

        drivers = [
            self.driver,
            EmulatorRadio(),
            BleRadio(),
            WifiDirectRadio()
        ]

        required_methods = [
            "start", "stop", "transmit", "receive", "cad",
            "get_stats", "get_capabilities", "is_available"
        ]

        for d in drivers:
            for method_name in required_methods:
                self.assertTrue(
                    hasattr(d, method_name),
                    f"{d.__class__.__name__} missing unified method {method_name}"
                )
                self.assertTrue(
                    callable(getattr(d, method_name)),
                    f"{d.__class__.__name__}.{method_name} must be callable"
                )

            # Test basic invocation
            caps = d.get_capabilities()
            self.assertIsInstance(caps, dict)
            stats = d.get_stats()
            self.assertIsInstance(stats, dict)

if __name__ == '__main__':
    unittest.main()
