"""
Cross-Platform Test Suite: Verifies Python BinaryCodec against canonical Golden Vectors
Matches TypeScript serializePacket/deserializePacket byte-for-byte.
"""

import os
import unittest
from pi.protocol.frame import BinaryCodec, HoimuPacketType

VECTORS_DIR = os.path.join(os.path.dirname(__file__), '../../protocol/vectors')

class TestGoldenVectors(unittest.TestCase):
    def test_golden_vectors_exist(self):
        expected_files = ['data-001.hex', 'encrypted-001.hex', 'sos-001.hex', 'ack-001.hex', 'routing-001.hex']
        for filename in expected_files:
            path = os.path.join(VECTORS_DIR, filename)
            self.assertTrue(os.path.isfile(path), f"Missing vector file: {filename}")

    def test_data_001_decode_and_reencode(self):
        path = os.path.join(VECTORS_DIR, 'data-001.hex')
        with open(path, 'r') as f:
            hex_content = f.read().strip()

        raw_bytes = bytes.fromhex(hex_content)
        decoded = BinaryCodec.decode(raw_bytes)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded['version'], 1)
        self.assertEqual(decoded['type'], HoimuPacketType.MESSAGE)
        self.assertEqual(decoded['originId'], 'TAL-01')
        self.assertEqual(decoded['destinationId'], '*')
        self.assertEqual(decoded['packetId'], 'PKT101')
        self.assertEqual(decoded['sequence'], 101)
        self.assertEqual(decoded['payload'], {'text': 'Hello Tallinn mesh'})

        # Re-encode and verify identical hex
        reencoded = BinaryCodec.encode(
            packet_type=decoded['type'],
            origin_id=decoded['originId'],
            dest_id=decoded['destinationId'],
            packet_id=decoded['packetId'],
            ttl=decoded['ttl'],
            sequence=decoded['sequence'],
            payload_data=decoded['payload'],
            signature=decoded.get('signature'),
            flags=decoded['flags'],
            hop_count=decoded['hopCount']
        )
        self.assertEqual(reencoded.hex(), hex_content)

    def test_encrypted_001_decode_and_reencode(self):
        path = os.path.join(VECTORS_DIR, 'encrypted-001.hex')
        with open(path, 'r') as f:
            hex_content = f.read().strip()

        raw_bytes = bytes.fromhex(hex_content)
        decoded = BinaryCodec.decode(raw_bytes)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded['type'], HoimuPacketType.DIRECT_ENCRYPTED)
        self.assertEqual(decoded['originId'], 'NODE-A')
        self.assertEqual(decoded['destinationId'], 'NODE-B')
        self.assertEqual(decoded['packetId'], 'ENC102')
        self.assertEqual(decoded['sequence'], 102)
        self.assertEqual(decoded['payload']['ciphertextHex'], 'a1b2c3d4e5f6')

        reencoded = BinaryCodec.encode(
            packet_type=decoded['type'],
            origin_id=decoded['originId'],
            dest_id=decoded['destinationId'],
            packet_id=decoded['packetId'],
            ttl=decoded['ttl'],
            sequence=decoded['sequence'],
            payload_data=decoded['payload'],
            signature=decoded.get('signature'),
            flags=decoded['flags'],
            hop_count=decoded['hopCount']
        )
        self.assertEqual(reencoded.hex(), hex_content)

    def test_sos_001_decode_and_reencode(self):
        path = os.path.join(VECTORS_DIR, 'sos-001.hex')
        with open(path, 'r') as f:
            hex_content = f.read().strip()

        raw_bytes = bytes.fromhex(hex_content)
        decoded = BinaryCodec.decode(raw_bytes)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded['type'], HoimuPacketType.SOS)
        self.assertEqual(decoded['originId'], 'RESCUE')
        self.assertEqual(decoded['destinationId'], '*')
        self.assertEqual(decoded['packetId'], 'SOS103')
        self.assertEqual(decoded['payload']['emergencyType'], 'medical')
        self.assertEqual(decoded['payload']['callsign'], 'TALLINN-ALPHA')

        reencoded = BinaryCodec.encode(
            packet_type=decoded['type'],
            origin_id=decoded['originId'],
            dest_id=decoded['destinationId'],
            packet_id=decoded['packetId'],
            ttl=decoded['ttl'],
            sequence=decoded['sequence'],
            payload_data=decoded['payload'],
            signature=decoded.get('signature'),
            flags=decoded['flags'],
            hop_count=decoded['hopCount']
        )
        self.assertEqual(reencoded.hex(), hex_content)

    def test_ack_001_decode_and_reencode(self):
        path = os.path.join(VECTORS_DIR, 'ack-001.hex')
        with open(path, 'r') as f:
            hex_content = f.read().strip()

        raw_bytes = bytes.fromhex(hex_content)
        decoded = BinaryCodec.decode(raw_bytes)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded['type'], HoimuPacketType.ACK)
        self.assertEqual(decoded['originId'], 'RELAY-1')
        self.assertEqual(decoded['destinationId'], 'TAL-01')
        self.assertEqual(decoded['packetId'], 'ACK104')
        self.assertEqual(decoded['payload']['ackStatus'], 'received')

        reencoded = BinaryCodec.encode(
            packet_type=decoded['type'],
            origin_id=decoded['originId'],
            dest_id=decoded['destinationId'],
            packet_id=decoded['packetId'],
            ttl=decoded['ttl'],
            sequence=decoded['sequence'],
            payload_data=decoded['payload'],
            signature=decoded.get('signature'),
            flags=decoded['flags'],
            hop_count=decoded['hopCount']
        )
        self.assertEqual(reencoded.hex(), hex_content)

    def test_routing_001_decode_and_reencode(self):
        path = os.path.join(VECTORS_DIR, 'routing-001.hex')
        with open(path, 'r') as f:
            hex_content = f.read().strip()

        raw_bytes = bytes.fromhex(hex_content)
        decoded = BinaryCodec.decode(raw_bytes)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded['type'], HoimuPacketType.ROUTE_ANNOUNCE)
        self.assertEqual(decoded['originId'], 'GATE-01')
        self.assertEqual(decoded['destinationId'], '*')
        self.assertEqual(decoded['packetId'], 'RTE105')
        self.assertEqual(decoded['payload']['routerNodeId'], 'GATE-01')

        reencoded = BinaryCodec.encode(
            packet_type=decoded['type'],
            origin_id=decoded['originId'],
            dest_id=decoded['destinationId'],
            packet_id=decoded['packetId'],
            ttl=decoded['ttl'],
            sequence=decoded['sequence'],
            payload_data=decoded['payload'],
            signature=decoded.get('signature'),
            flags=decoded['flags'],
            hop_count=decoded['hopCount']
        )
        self.assertEqual(reencoded.hex(), hex_content)

if __name__ == '__main__':
    unittest.main()
