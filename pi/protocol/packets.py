"""
HÕIMU Protocol Packet Definitions (53-byte Binary Wire Standard)
"""

from dataclasses import dataclass
from typing import Optional, Any, Dict

PROTOCOL_MAGIC = 0x484F494D  # "HOIM"
PROTOCOL_VERSION = 1

HEADER_SIZE_BYTES = 53
SIGNATURE_SIZE_BYTES = 64
CRC_SIZE_BYTES = 4
MAX_PACKET_SIZE_BYTES = 255

class HoimuPacketType:
    MESSAGE = 0x01
    DIRECT_ENCRYPTED = 0x02
    SOS = 0x03
    CRDT_SYNC = 0x04
    ROUTE_ANNOUNCE = 0x05
    ACK = 0x06

class PacketFlags:
    NONE = 0x00
    IS_SIGNED = 0x01
    IS_ENCRYPTED = 0x02
    IS_PRIORITY = 0x04
    ACK_REQUESTED = 0x08
    COMPRESSED = 0x10

@dataclass
class PacketHeader:
    magic: int
    version: int
    type: int
    flags: int
    ttl: int
    hop_count: int
    sequence: int
    origin_id: str
    destination_id: str
    packet_id: str
    created_at_epoch_sec: int
    lifetime_sec: int
    payload_length: int

@dataclass
class BinaryWirePacket:
    header: PacketHeader
    payload: Any
    signature_bytes: Optional[bytes] = None
    signature: Optional[str] = None
    crc: Optional[int] = None
    raw_bytes: Optional[bytes] = None
