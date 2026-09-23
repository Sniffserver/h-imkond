"""
SQLite Storage Engine for HÕIMU Pi Gateway
"""

import sqlite3
import time
import os
from typing import List, Dict, Any, Optional

DEFAULT_DB_PATH = "/var/lib/hoimu/hoimu_gateway.db"

class SQLiteStorage:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        # Allow directory fallback for non-root / local dev
        if not os.path.exists(os.path.dirname(self.db_path)) and os.path.dirname(self.db_path):
            try:
                os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            except Exception:
                self.db_path = "hoimu_gateway.db"

        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        with self.conn:
            # Inbox
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS inbox (
                    packet_id TEXT PRIMARY KEY,
                    origin_id TEXT,
                    destination_id TEXT,
                    packet_type INTEGER,
                    flags INTEGER,
                    ttl INTEGER,
                    hop_count INTEGER,
                    sequence INTEGER,
                    payload TEXT,
                    signature TEXT,
                    received_at INTEGER,
                    is_read INTEGER DEFAULT 0
                )
            """)

            # Outbox
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS outbox (
                    packet_id TEXT PRIMARY KEY,
                    destination_id TEXT,
                    payload TEXT,
                    status TEXT,
                    attempts INTEGER DEFAULT 0,
                    created_at INTEGER,
                    last_attempt_at INTEGER
                )
            """)

            # Peers
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS peers (
                    node_id TEXT PRIMARY KEY,
                    callsign TEXT,
                    public_key TEXT,
                    last_seen INTEGER,
                    hop_count INTEGER,
                    snr REAL,
                    rssi REAL
                )
            """)

            # Duty cycle airtime persistence (8.4)
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS duty_cycle (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL,
                    airtime_ms INTEGER,
                    priority INTEGER
                )
            """)
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_duty_cycle_ts ON duty_cycle(timestamp)")

            # Events
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT,
                    node_id TEXT,
                    details TEXT,
                    timestamp INTEGER
                )
            """)

    # Duty cycle persistent operations (8.4)
    def record_airtime(self, timestamp: float, airtime_ms: int, priority: int = 1):
        with self.conn:
            self.conn.execute(
                "INSERT INTO duty_cycle (timestamp, airtime_ms, priority) VALUES (?, ?, ?)",
                (timestamp, airtime_ms, priority)
            )

    def get_airtime_window(self, cutoff_timestamp: float) -> List[Dict[str, Any]]:
        cursor = self.conn.execute(
            "SELECT timestamp, airtime_ms, priority FROM duty_cycle WHERE timestamp >= ?",
            (cutoff_timestamp,)
        )
        return [dict(row) for row in cursor.fetchall()]

    def prune_duty_cycle(self, max_age_seconds: float = 86400.0):
        cutoff = time.time() - max_age_seconds
        with self.conn:
            self.conn.execute("DELETE FROM duty_cycle WHERE timestamp < ?", (cutoff,))

    def close(self):
        self.conn.close()
