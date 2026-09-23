"""
Pi Local Storage (SQLite3) for persistent mesh store-and-forward outbox & packet ledger
"""

import sqlite3
import time
import os

class SQLiteMeshStore:
    def __init__(self, db_path="/tmp/hoimu_mesh.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS packets (
                packet_id TEXT PRIMARY KEY,
                origin_id TEXT,
                dest_id TEXT,
                ttl INTEGER,
                hop_count INTEGER,
                raw_bytes BLOB,
                received_at INTEGER
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS seen_cache (
                packet_id TEXT PRIMARY KEY,
                expires_at INTEGER
            )
        """)
        conn.commit()
        conn.close()

    def is_duplicate(self, packet_id: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        now = int(time.time() * 1000)
        cur.execute("SELECT expires_at FROM seen_cache WHERE packet_id = ?", (packet_id,))
        row = cur.fetchone()
        if row:
            if now < row[0]:
                conn.close()
                return True
            cur.execute("DELETE FROM seen_cache WHERE packet_id = ?", (packet_id,))
        
        # Mark seen (15 min TTL)
        cur.execute("INSERT OR REPLACE INTO seen_cache VALUES (?, ?)", (packet_id, now + 15*60*1000))
        conn.commit()
        conn.close()
        return False

    def save_packet(self, packet_id: str, origin: str, dest: str, ttl: int, hop: int, raw_bytes: bytes):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO packets VALUES (?, ?, ?, ?, ?, ?, ?)",
            (packet_id, origin, dest, ttl, hop, raw_bytes, int(time.time() * 1000))
        )
        conn.commit()
        conn.close()
