"""
Inbox Storage for HÕIMU Pi Gateway
"""

import json
from typing import List, Dict, Any, Optional
from .sqlite import SQLiteStorage

class InboxStore:
    def __init__(self, storage: SQLiteStorage):
        self.storage = storage

    def save(self, packet_dict: Dict[str, Any]):
        payload_json = json.dumps(packet_dict.get("payload"))
        with self.storage.conn:
            self.storage.conn.execute("""
                INSERT OR REPLACE INTO inbox (
                    packet_id, origin_id, destination_id, packet_type, flags,
                    ttl, hop_count, sequence, payload, signature, received_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                packet_dict["packetId"],
                packet_dict.get("originId"),
                packet_dict.get("destinationId"),
                packet_dict.get("type"),
                packet_dict.get("flags", 0),
                packet_dict.get("ttl", 0),
                packet_dict.get("hopCount", 0),
                packet_dict.get("sequence", 0),
                payload_json,
                packet_dict.get("signature"),
                packet_dict.get("receivedAt")
            ))

    def get_all(self, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = self.storage.conn.execute(
            "SELECT * FROM inbox ORDER BY received_at DESC LIMIT ?",
            (limit,)
        )
        results = []
        for row in cursor.fetchall():
            item = dict(row)
            try:
                item["payload"] = json.loads(item["payload"])
            except Exception:
                pass
            results.append(item)
        return results

    def mark_read(self, packet_id: str):
        with self.storage.conn:
            self.storage.conn.execute(
                "UPDATE inbox SET is_read = 1 WHERE packet_id = ?",
                (packet_id,)
            )
