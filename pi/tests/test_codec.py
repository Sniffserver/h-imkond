"""
Unit Tests for Python BinaryCodec
Tests packet serialization, deserialization, CRC verification, and edge cases.
"""

import unittest
from pi.protocol.frame import BinaryCodec, HoimuPacketType, PacketFlags

class TestBinaryCodec(unittest.TestCase):
    def test_roundtrip_simple_message(self):
        raw = BinaryCodec.encode(
            packet_type=HoimuPacketType.MESSAGE,
            origin_id="ALPHA",
            dest_id="BETA",
            packet_id="MSG01",
            ttl=7,
            sequence=42,
            payload_data={"text": "Test message"}
        )
        self.assertGreaterEqual(len(raw), 43)
        decoded = BinaryCodec.decode(raw)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded['originId'], 'ALPHA')
        self.assertEqual(decoded['destinationId'], 'BETA')
        self.assertEqual(decoded['packetId'], 'MSG01')
        self.assertEqual(decoded['sequence'], 42)
        self.assertEqual(decoded['payload'], {"text": "Test message"})

    def test_corrupted_crc_rejected(self):
        raw = BinaryCodec.encode(
            packet_type=HoimuPacketType.MESSAGE,
            origin_id="ALPHA",
            dest_id="*",
            packet_id="MSG02",
            ttl=5,
            sequence=1,
            payload_data="hello"
        )
        # Corrupt last byte
        corrupted = bytearray(raw)
        corrupted[-1] ^= 0xFF
        self.assertIsNone(BinaryCodec.decode(bytes(corrupted)))

    def test_truncated_packet_rejected(self):
        raw = BinaryCodec.encode(
            packet_type=HoimuPacketType.SOS,
            origin_id="RESCUE",
            dest_id="*",
            packet_id="SOS99",
            ttl=10,
            sequence=99,
            payload_data={"help": True}
        )
        truncated = raw[:30]
        self.assertIsNone(BinaryCodec.decode(truncated))

if __name__ == '__main__':
    unittest.main()
