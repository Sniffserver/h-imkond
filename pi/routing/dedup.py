"""
Packet Deduplication & LRU Cache
"""

import time
from typing import Dict
from collections import OrderedDict

class DedupFilter:
    def __init__(self, max_size: int = 1000, ttl_seconds: float = 300.0):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._seen: OrderedDict[str, float] = OrderedDict()

    def is_seen(self, packet_id: str) -> bool:
        """
        Checks if packet_id was seen recently. If not seen, records it.
        Returns True if already seen (duplicate), False if fresh.
        """
        now = time.time()
        self._prune(now)

        if packet_id in self._seen:
            # Move to end (LRU update)
            self._seen.move_to_end(packet_id)
            return True

        self._seen[packet_id] = now
        if len(self._seen) > self.max_size:
            self._seen.popitem(last=False)
        return False

    def _prune(self, now: float):
        cutoff = now - self.ttl_seconds
        while self._seen:
            first_key, first_ts = next(iter(self._seen.items()))
            if first_ts < cutoff:
                self._seen.pop(first_key)
            else:
                break

    def clear(self):
        self._seen.clear()

    def size(self) -> int:
        return len(self._seen)
