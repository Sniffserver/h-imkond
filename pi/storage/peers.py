"""
HÕIMU SQLite Peer Registry & Trust Store for Raspberry Pi Gateway
"""

import sqlite3
import time
from typing import Optional, List, Dict, Any

class PeerStore:
    def __init__(self, db_path: str = "/var/lib/hoimu/peers.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS peers (
                    node_id TEXT PRIMARY KEY,
                    callsign TEXT,
                    signing_public_key_hex TEXT,
                    encryption_public_key_hex TEXT,
                    trust_state TEXT DEFAULT 'unknown',
                    first_seen_at REAL,
                    last_seen_at REAL,
                    key_version INTEGER DEFAULT 1,
                    can_relay INTEGER DEFAULT 1,
                    is_gateway INTEGER DEFAULT 0
                )
            """)
            conn.commit()

    def upsert_peer(
        self,
        node_id: str,
        callsign: str,
        signing_public_key_hex: str,
        encryption_public_key_hex: Optional[str] = None,
        trust_state: str = "unknown",
        key_version: int = 1
    ):
        now = time.time()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO peers (
                    node_id, callsign, signing_public_key_hex,
                    encryption_public_key_hex, trust_state,
                    first_seen_at, last_seen_at, key_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(node_id) DO UPDATE SET
                    callsign = excluded.callsign,
                    signing_public_key_hex = excluded.signing_public_key_hex,
                    encryption_public_key_hex = COALESCE(excluded.encryption_public_key_hex, peers.encryption_public_key_hex),
                    last_seen_at = excluded.last_seen_at,
                    key_version = excluded.key_version
            """, (
                node_id, callsign, signing_public_key_hex,
                encryption_public_key_hex, trust_state, now, now, key_version
            ))
            conn.commit()

    def get_peer(self, node_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM peers WHERE node_id = ?", (node_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_peers(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM peers ORDER BY last_seen_at DESC")
            return [dict(r) for r in cur.fetchall()]
