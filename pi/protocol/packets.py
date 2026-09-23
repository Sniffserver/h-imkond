"""
HÕIMU Protocol Packet Definitions
"""

from dataclasses import dataclass
from typing import Optional, Any, Dict

PROTOCOL_MAGIC = 0x484F494D  # "HOIM"
PROTOCOL_VERSION = 1

class HoimuPacketType:
    MESSAGE = 0x01
    DIRECT_ENCRYPTED = 0x02
    SOS = 0x03
    CRDT_SYNC = 0x04
    ROUTE_ANNOUNCE = 0x05
    ACK = 0x06

class PacketFlags:
    NONE = 0x00
    IS_ENCRYPTED = 0x01
    IS_PRIORITY = 0x02
    ACK_REQUESTED = 0x04
    COMPRESSED = 0x08

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
    payload_length: int

@dataclass
class BinaryWirePacket:
    header: PacketHeader
    payload: Any
    signature: Optional[str] = None
    crc: Optional[int] = None
    raw_bytes: Optional[bytes] = None
