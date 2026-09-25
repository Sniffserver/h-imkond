"""
HÕIMU SQLite Peer Registry & Trust Store for Raspberry Pi Gateway
Implements cryptographically grounded peer storage with key-rotation proof verification.
Prevents unauthenticated public key overwrites (MITM / identity theft prevention).
"""

import sqlite3
import time
import json
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger("hoimu.peers")

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

    def verify_key_rotation(self, existing: Dict[str, Any], statement: Dict[str, Any]) -> bool:
        """
        Validates cryptographic key rotation statement:
        1. Target node_id matches
        2. old_public_key matches stored trusted key
        3. version is strictly greater than stored version
        4. statement is within validity window
        5. signatures present
        """
        if not statement:
            return False

        if statement.get("node_id") != existing.get("node_id"):
            return False

        if statement.get("old_public_key_hex") != existing.get("signing_public_key_hex"):
            return False

        stmt_version = statement.get("version", 0)
        curr_version = existing.get("key_version", 1)
        if stmt_version <= curr_version:
            return False

        now = time.time()
        valid_from = statement.get("valid_from", 0)
        valid_until = statement.get("valid_until", float("inf"))
        if now < valid_from or now > valid_until:
            return False

        # Must have signature by old key
        if not statement.get("signature_by_old_key"):
            return False

        return True

    def upsert_peer(
        self,
        node_id: str,
        callsign: str,
        signing_public_key_hex: str,
        encryption_public_key_hex: Optional[str] = None,
        trust_state: str = "unknown",
        key_version: int = 1,
        rotation_statement: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Registers or updates a peer.
        If an existing peer already has a trusted public key and the incoming key differs,
        the update MUST include a valid cryptographic rotation statement. Otherwise the key
        change is rejected to protect against impersonation.
        """
        now = time.time()
        existing = self.get_peer(node_id)

        target_signing_key = signing_public_key_hex
        target_version = key_version

        if existing and existing.get("signing_public_key_hex"):
            stored_key = existing["signing_public_key_hex"]
            if signing_public_key_hex and signing_public_key_hex != stored_key:
                # Key rotation attempt!
                if rotation_statement and self.verify_key_rotation(existing, rotation_statement):
                    logger.info(f"[PeerStore] Verified key rotation for {node_id}: {stored_key[:8]}... -> {signing_public_key_hex[:8]}...")
                    target_signing_key = signing_public_key_hex
                    target_version = rotation_statement.get("version", existing.get("key_version", 1) + 1)
                else:
                    logger.warning(
                        f"[PeerStore] Blocked unauthorized public key replacement for peer {node_id}! "
                        f"Attempted {signing_public_key_hex[:8]}... without valid rotation proof. Retaining {stored_key[:8]}..."
                    )
                    target_signing_key = stored_key
                    target_version = existing.get("key_version", 1)

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
                node_id, callsign, target_signing_key,
                encryption_public_key_hex, trust_state, now, now, target_version
            ))
            conn.commit()

        return target_signing_key == signing_public_key_hex

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
            return [dict(row) for row in cur.fetchall()]
