"""
HÕIMU Canonical Protocol Binary Frame Codec for Python (Raspberry Pi Gateway)
Matches TypeScript encodeBinaryPacket / decodeBinaryPacket exactly with:
- 53-byte fixed header
- Raw application payload bytes
- 64-byte Ed25519 binary signature (if IS_SIGNED flag set)
- 4-byte IEEE 802.3 CRC32
"""

import struct
import zlib
import json
import time
from typing import Optional, Dict, Any, Union

from .packets import (
    PROTOCOL_MAGIC,
    PROTOCOL_VERSION,
    HEADER_SIZE_BYTES,
    SIGNATURE_SIZE_BYTES,
    CRC_SIZE_BYTES,
    HoimuPacketType,
    PacketFlags,
    PacketHeader,
    BinaryWirePacket
)

# Header format:
# Magic(4:I), Version(1:B), Type(1:B), Flags(1:B), TTL(1:B), HopCount(1:B),
# Sequence(4:I), Origin(8:8s), Dest(8:8s), PacketId(16:16s),
# CreatedAt(4:I), Lifetime(2:H), PayloadLength(2:H)
HEADER_STRUCT_FORMAT = ">IBBBBBI8s8s16sIHH"

def _encode_16b_packet_id(packet_id: str) -> bytes:
    clean = "".join(c for c in packet_id if c in "0123456789abcdefABCDEF")
    if len(clean) == 32:
        return bytes.fromhex(clean)
    return packet_id.encode('utf-8')[:16].ljust(16, b' ')

def _decode_16b_packet_id(raw_16b: bytes) -> str:
    is_printable = True
    for b in raw_16b:
        if b != 0 and (b < 32 or b > 126):
            is_printable = False
            break
    if is_printable:
        text = raw_16b.decode('utf-8', errors='ignore').strip()
        if len(text) > 0:
            return text
    return raw_16b.hex()

class BinaryCodec:
    HEADER_FORMAT = HEADER_STRUCT_FORMAT
    HEADER_SIZE = HEADER_SIZE_BYTES

    @staticmethod
    def encode(
        packet_type: int,
        origin_id: str,
        dest_id: str,
        packet_id: str,
        ttl: int,
        sequence: int,
        payload_data: Any,
        signature: Optional[Union[str, bytes]] = None,
        flags: int = 0,
        hop_count: int = 0,
        created_at_epoch_sec: Optional[int] = None,
        lifetime_sec: int = 900
    ) -> bytes:
        if isinstance(payload_data, (bytes, bytearray)):
            payload_bytes = bytes(payload_data)
        elif isinstance(payload_data, str):
            payload_bytes = payload_data.encode('utf-8')
        else:
            payload_str = json.dumps(payload_data, separators=(',', ':'), sort_keys=True)
            payload_bytes = payload_str.encode('utf-8')

        sig_bytes = b''
        if signature:
            if isinstance(signature, str):
                sig_bytes = bytes.fromhex(signature)
            else:
                sig_bytes = bytes(signature)
            flags |= PacketFlags.IS_SIGNED

        origin_padded = origin_id.encode('utf-8')[:8].ljust(8, b' ')
        dest_padded = dest_id.encode('utf-8')[:8].ljust(8, b' ')
        packet_id_16b = _encode_16b_packet_id(packet_id)

        now_sec = created_at_epoch_sec if created_at_epoch_sec is not None else int(time.time())

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
            packet_id_16b,
            now_sec,
            lifetime_sec,
            len(payload_bytes)
        )

        frame_without_crc = header_bytes + payload_bytes + sig_bytes
        crc = zlib.crc32(frame_without_crc) & 0xFFFFFFFF
        crc_bytes = struct.pack(">I", crc)

        return frame_without_crc + crc_bytes

    @staticmethod
    def decode(raw_bytes: bytes) -> Optional[Dict[str, Any]]:
        if len(raw_bytes) < HEADER_SIZE_BYTES + CRC_SIZE_BYTES:
            return None

        # Verify CRC32
        content = raw_bytes[:-4]
        expected_crc = struct.unpack(">I", raw_bytes[-4:])[0]
        actual_crc = zlib.crc32(content) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            return None

        (
            magic, version, pkt_type, flags, ttl, hop_count, sequence,
            origin_raw, dest_raw, pkt_id_raw,
            created_at_sec, lifetime_sec, payload_len
        ) = struct.unpack(BinaryCodec.HEADER_FORMAT, raw_bytes[:HEADER_SIZE_BYTES])

        if magic != PROTOCOL_MAGIC or version != PROTOCOL_VERSION:
            return None

        is_signed = bool(flags & PacketFlags.IS_SIGNED)
        sig_len = SIGNATURE_SIZE_BYTES if is_signed else 0
        expected_total = HEADER_SIZE_BYTES + payload_len + sig_len + CRC_SIZE_BYTES

        if len(raw_bytes) < expected_total:
            return None

        payload_bytes = raw_bytes[HEADER_SIZE_BYTES : HEADER_SIZE_BYTES + payload_len]
        try:
            payload_str = payload_bytes.decode('utf-8')
            payload = json.loads(payload_str)
        except Exception:
            payload = payload_bytes.decode('utf-8', errors='replace')

        sig_hex = None
        sig_raw = None
        if is_signed:
            sig_start = HEADER_SIZE_BYTES + payload_len
            sig_raw = raw_bytes[sig_start : sig_start + SIGNATURE_SIZE_BYTES]
            sig_hex = sig_raw.hex()

        origin_id = origin_raw.decode('utf-8', errors='ignore').strip()
        dest_id = dest_raw.decode('utf-8', errors='ignore').strip()
        packet_id = _decode_16b_packet_id(pkt_id_raw)

        return {
            "version": version,
            "type": pkt_type,
            "flags": flags,
            "ttl": ttl,
            "hopCount": hop_count,
            "sequence": sequence,
            "originId": origin_id,
            "destinationId": dest_id,
            "packetId": packet_id,
            "createdAtEpochSeconds": created_at_sec,
            "lifetimeSeconds": lifetime_sec,
            "createdAt": created_at_sec * 1000,
            "expiresAt": (created_at_sec + (lifetime_sec or 900)) * 1000,
            "payload": payload,
            "signature": sig_hex,
            "signatureBytes": sig_raw,
            "crc": expected_crc,
            "receivedAt": int(time.time() * 1000)
        }

    @staticmethod
    def build_signature_preimage(header_dict: Dict[str, Any], payload_bytes: bytes) -> bytes:
        """
        Builds the 53-byte invariant header (with masked TTL=0 and hopCount=0) + payload
        for Ed25519 signing / verification.
        """
        flags = header_dict.get("flags", 0) | PacketFlags.IS_SIGNED
        origin_padded = header_dict["originId"].encode('utf-8')[:8].ljust(8, b' ')
        dest_padded = header_dict["destinationId"].encode('utf-8')[:8].ljust(8, b' ')
        packet_id_16b = _encode_16b_packet_id(header_dict["packetId"])
        created_at_sec = header_dict.get("createdAtEpochSeconds", int(time.time()))
        lifetime_sec = header_dict.get("lifetimeSeconds", 900)

        header_bytes = struct.pack(
            BinaryCodec.HEADER_FORMAT,
            PROTOCOL_MAGIC,
            PROTOCOL_VERSION,
            header_dict["type"],
            flags,
            0, # Masked TTL
            0, # Masked HopCount
            header_dict.get("sequence", 0),
            origin_padded,
            dest_padded,
            packet_id_16b,
            created_at_sec,
            lifetime_sec,
            len(payload_bytes)
        )
        return header_bytes + payload_bytes
