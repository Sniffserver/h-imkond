"""
HÕIMU Protocol Binary Frame Codec for Python (Raspberry Pi Gateway)
Matches TypeScript encodeBinaryPacket/decodeBinaryPacket exactly with CRC32.
"""

import struct
import zlib
import json
import time

PROTOCOL_MAGIC = 0x484F494D  # "HOIM"
PROTOCOL_VERSION = 1

class HoimuPacketType:
    MESSAGE = 0x01
    DIRECT_ENCRYPTED = 0x02
    SOS = 0x03
    CRDT_SYNC = 0x04
    ROUTE_ANNOUNCE = 0x05
    ACK = 0x06

class BinaryCodec:
    HEADER_FORMAT = ">IBBBBBII8s8s8sH" # 39 bytes total
    # Magic(4), Version(1), Type(1), Flags(1), TTL(1), HopCount(1), Sequence(4), 
    # Origin(8), Dest(8), PacketId(8), PayloadLength(2)

    @staticmethod
    def encode(packet_type: int, origin_id: str, dest_id: str, packet_id: str, ttl: int, sequence: int, payload_data) -> bytes:
        if isinstance(payload_data, (dict, list)):
            payload_str = json.dumps(payload_data, separators=(',', ':'))
        else:
            payload_str = str(payload_data)
        payload_bytes = payload_str.encode('utf-8')

        origin_padded = origin_id.encode('utf-8')[:8].ljust(8, b' ')
        dest_padded = dest_id.encode('utf-8')[:8].ljust(8, b' ')
        packet_id_padded = packet_id.encode('utf-8')[:8].ljust(8, b' ')

        header_bytes = struct.pack(
            BinaryCodec.HEADER_FORMAT,
            PROTOCOL_MAGIC,
            PROTOCOL_VERSION,
            packet_type,
            0x00, # flags
            ttl,
            0, # hopCount
            sequence,
            origin_padded,
            dest_padded,
            packet_id_padded,
            len(payload_bytes)
        )

        frame_without_crc = header_bytes + payload_bytes
        crc = zlib.crc32(frame_without_crc) & 0xFFFFFFFF
        crc_bytes = struct.pack(">I", crc)

        return frame_without_crc + crc_bytes

    @staticmethod
    def decode(raw_bytes: bytes):
        if len(raw_bytes) < 43:
            return None

        # Verify CRC
        content = raw_bytes[:-4]
        expected_crc = struct.unpack(">I", raw_bytes[-4:])[0]
        actual_crc = zlib.crc32(content) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            return None

        magic, version, pkt_type, flags, ttl, hop_count, sequence, origin_raw, dest_raw, pkt_id_raw, payload_len = struct.unpack(
            BinaryCodec.HEADER_FORMAT, raw_bytes[:39]
        )

        if magic != PROTOCOL_MAGIC:
            return None

        payload_bytes = raw_bytes[39:39+payload_len]
        try:
            payload_str = payload_bytes.decode('utf-8')
            try:
                payload = json.loads(payload_str)
            except:
                payload = payload_str
        except:
            payload = payload_bytes

        return {
            "version": version,
            "type": pkt_type,
            "flags": flags,
            "ttl": ttl,
            "hopCount": hop_count,
            "sequence": sequence,
            "originId": origin_raw.decode('utf-8').strip(),
            "destinationId": dest_raw.decode('utf-8').strip(),
            "packetId": pkt_id_raw.decode('utf-8').strip(),
            "payload": payload,
            "receivedAt": int(time.time() * 1000)
        }
