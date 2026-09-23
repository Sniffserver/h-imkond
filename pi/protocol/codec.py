"""
HÕIMU Protocol Binary Frame Codec for Python (Raspberry Pi Gateway)
Matches TypeScript encodeBinaryPacket / decodeBinaryPacket exactly with CRC32.
"""

import struct
import zlib
import json
import time
from typing import Optional, Dict, Any

from .packets import (
    PROTOCOL_MAGIC,
    PROTOCOL_VERSION,
    HoimuPacketType,
    PacketFlags,
    PacketHeader,
    BinaryWirePacket
)

class BinaryCodec:
    # 39 bytes header:
    # Magic(4:I), Version(1:B), Type(1:B), Flags(1:B), TTL(1:B), HopCount(1:B),
    # Sequence(4:I), Origin(8:8s), Dest(8:8s), PacketId(8:8s), PayloadLength(2:H)
    HEADER_FORMAT = ">IBBBBBI8s8s8sH"
    HEADER_SIZE = 39

    @staticmethod
    def encode(
        packet_type: int,
        origin_id: str,
        dest_id: str,
        packet_id: str,
        ttl: int,
        sequence: int,
        payload_data: Any,
        signature: Optional[str] = None,
        flags: int = 0,
        hop_count: int = 0
    ) -> bytes:
        payload_container: Dict[str, Any] = {"data": payload_data}
        if signature:
            payload_container["signature"] = signature
        payload_str = json.dumps(payload_container, separators=(',', ':'), sort_keys=True)
        payload_bytes = payload_str.encode('utf-8')

        origin_padded = origin_id.encode('utf-8')[:8].ljust(8, b' ')
        dest_padded = dest_id.encode('utf-8')[:8].ljust(8, b' ')
        packet_id_padded = packet_id.encode('utf-8')[:8].ljust(8, b' ')

        header_bytes = struct.pack(
            BinaryCodec.HEADER_FORMAT,
            PROTOCOL_MAGIC,
            PROTOCOL_VERSION,
            packet_type,
            flags,
            ttl,
            hop_count,
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
    def decode(raw_bytes: bytes) -> Optional[Dict[str, Any]]:
        # 39 bytes header + min 0 payload + 4 bytes CRC = 43 bytes min
        if len(raw_bytes) < 43:
            return None

        # Verify CRC32
        content = raw_bytes[:-4]
        expected_crc = struct.unpack(">I", raw_bytes[-4:])[0]
        actual_crc = zlib.crc32(content) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            return None

        magic, version, pkt_type, flags, ttl, hop_count, sequence, origin_raw, dest_raw, pkt_id_raw, payload_len = struct.unpack(
            BinaryCodec.HEADER_FORMAT, raw_bytes[:39]
        )

        if magic != PROTOCOL_MAGIC or version != PROTOCOL_VERSION:
            return None

        if len(raw_bytes) < 39 + payload_len + 4:
            return None

        payload_bytes = raw_bytes[39:39+payload_len]
        try:
            payload_str = payload_bytes.decode('utf-8')
            parsed = json.loads(payload_str)
            if isinstance(parsed, dict) and "data" in parsed:
                payload = parsed["data"]
                signature = parsed.get("signature")
            else:
                payload = parsed
                signature = None
        except Exception:
            payload = payload_bytes.decode('utf-8', errors='replace')
            signature = None

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
            "signature": signature,
            "crc": expected_crc,
            "receivedAt": int(time.time() * 1000)
        }
