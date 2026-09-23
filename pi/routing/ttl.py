"""
TTL & Hop Count Validation and Mutation
"""

from typing import Optional, Dict, Any

MAX_HOPS = 10
DEFAULT_TTL = 7

class TTLManager:
    @staticmethod
    def validate_and_decrement(packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Validates packet TTL and HopCount.
        Decrements TTL by 1 and increments HopCount by 1.
        Returns mutated packet dict if eligible for forwarding, or None if packet expired.
        """
        ttl = packet.get("ttl", 0)
        hop_count = packet.get("hopCount", 0)

        if ttl <= 1:
            # TTL exhausted
            return None

        if hop_count >= MAX_HOPS:
            # Hop limit reached
            return None

        updated = dict(packet)
        updated["ttl"] = ttl - 1
        updated["hopCount"] = hop_count + 1
        return updated

    @staticmethod
    def is_expired(packet: Dict[str, Any], max_age_ms: int = 86400000) -> bool:
        """
        Verifies timestamp-based expiry.
        """
        received_at = packet.get("receivedAt", 0)
        import time
        now_ms = int(time.time() * 1000)
        return (now_ms - received_at) > max_age_ms
