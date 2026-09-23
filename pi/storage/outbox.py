"""
Outbox Storage & Persistent Retry Queue for HÕIMU Pi Gateway
Handles bounded store-and-forward outbox states, TTL expiration pruning, and reboot recovery.
"""

import json
import time
from typing import List, Dict, Any, Optional
from .sqlite import SQLiteStorage

class OutboxStore:
    DEFAULT_TTL_SECONDS = 86400  # 24 hours
    MAX_ATTEMPTS = 5

    def __init__(self, storage: SQLiteStorage):
        self.storage = storage

    def save(self, item: Dict[str, Any]):
        payload_json = json.dumps(item.get("payload"))
        now = int(time.time())
        ttl = item.get("ttl_seconds", self.DEFAULT_TTL_SECONDS)
        expires_at = item.get("expires_at", now + ttl)

        with self.storage.conn:
            self.storage.conn.execute("""
                INSERT OR REPLACE INTO outbox (
                    packet_id, destination_id, payload, status, attempts, created_at, last_attempt_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                item["packet_id"],
                item.get("destination_id"),
                payload_json,
                item.get("status", "queued"),
                item.get("attempts", 0),
                item.get("created_at", now),
                now
            ))

    def get_pending(self, limit: int = 20) -> List[Dict[str, Any]]:
        cursor = self.storage.conn.execute(
            "SELECT * FROM outbox WHERE status IN ('queued', 'sending', 'sent', 'retrying') ORDER BY created_at ASC LIMIT ?",
            (limit,)
        )
        results = []
        for row in cursor.fetchall():
            res = dict(row)
            try:
                res["payload"] = json.loads(res["payload"])
            except Exception:
                pass
            results.append(res)
        return results

    def update_status(self, packet_id: str, status: str, increment_attempt: bool = False):
        now = int(time.time())
        with self.storage.conn:
            if increment_attempt:
                self.storage.conn.execute(
                    "UPDATE outbox SET status = ?, attempts = attempts + 1, last_attempt_at = ? WHERE packet_id = ?",
                    (status, now, packet_id)
                )
            else:
                self.storage.conn.execute(
                    "UPDATE outbox SET status = ?, last_attempt_at = ? WHERE packet_id = ?",
                    (status, now, packet_id)
                )

    def restore_and_prune_expired(self, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> List[Dict[str, Any]]:
        """
        Executed on Pi reboot:
        1. Identifies and updates expired packets to 'expired'.
        2. Restores valid pending packets to resume retransmission.
        """
        now = int(time.time())
        cutoff = now - ttl_seconds

        with self.storage.conn:
            # Mark packets created before cutoff as expired
            self.storage.conn.execute(
                "UPDATE outbox SET status = 'expired' WHERE created_at < ? AND status NOT IN ('acknowledged', 'failed')",
                (cutoff,)
            )

        return self.get_pending()
