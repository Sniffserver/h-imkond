"""
Secure Hardware Device Pairing & Capability Token Authorization
Pipeline: QR/PIN -> Ephemeral Session -> Device Identity -> Trust Confirmation -> Capability Token -> Store Peer
"""

import time
import secrets
import logging
from typing import Dict, Optional, Any

logger = logging.getLogger("hoimu.pairing")

class PairingManager:
    def __init__(self, auth_handler, pin_ttl_seconds: int = 300, peer_store = None):
        self.auth = auth_handler
        self.pin_ttl_seconds = pin_ttl_seconds
        self.peer_store = peer_store
        self._sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> metadata
        self._pin_index: Dict[str, str] = {}            # pin -> session_id

    def generate_pairing_session(self, client_id: str, client_pubkey: Optional[str] = None) -> Dict[str, Any]:
        """
        Step 1: Start pairing session, minting session_id, 6-digit PIN, and QR payload.
        """
        self._prune()
        session_id = f"pair_sess_{secrets.token_hex(6)}"
        pin = f"{secrets.randbelow(900000) + 100000:06d}"
        now = time.time()
        expires_at = now + self.pin_ttl_seconds

        qr_payload = f"hoimu://pair?session={session_id}&pin={pin}&client={client_id}"

        session_data = {
            "session_id": session_id,
            "pin": pin,
            "client_id": client_id,
            "client_pubkey": client_pubkey,
            "qr_payload": qr_payload,
            "created_at": now,
            "expires_at": expires_at,
            "status": "initiated"
        }

        self._sessions[session_id] = session_data
        self._pin_index[pin] = session_id

        logger.info(f"[Pairing] Initiated session {session_id} for client {client_id}")
        return session_data

    def generate_pairing_pin(self, client_id: str) -> str:
        """
        Legacy helper: returns generated 6-digit PIN string.
        """
        sess = self.generate_pairing_session(client_id)
        return sess["pin"]

    def complete_pairing(
        self,
        pin: str,
        client_id: str,
        session_id: Optional[str] = None,
        public_key: Optional[str] = None,
        role: str = "operator"
    ) -> Optional[Dict[str, Any]]:
        """
        Steps 2-5: Validate PIN/Session, register device identity, issue capability token, store peer.
        """
        self._prune()

        # Resolve session ID
        target_sess_id = session_id or self._pin_index.get(pin)
        if not target_sess_id:
            logger.warning(f"[Pairing] Failed: PIN {pin} not found or session expired")
            return None

        sess = self._sessions.get(target_sess_id)
        if not sess:
            return None

        # Expiry & client match check
        if time.time() > sess["expires_at"]:
            logger.warning(f"[Pairing] Failed: Session {target_sess_id} expired")
            self._cleanup_session(target_sess_id)
            return None

        if sess["pin"] != pin or sess["client_id"] != client_id:
            logger.warning(f"[Pairing] Mismatch client or PIN for session {target_sess_id}")
            return None

        # Device identity confirmed!
        pubkey = public_key or sess.get("client_pubkey") or f"pub_{client_id[:8]}"

        # Step 4: Trust Confirmation & Capability Token Generation
        token = self.auth.generate_token(
            subject=client_id,
            role=role,
            ttl_seconds=86400 * 30  # 30 day device capability credential
        )

        # Step 5: Store Peer in persistent storage (No anonymous magic tokens allowed)
        if self.peer_store and hasattr(self.peer_store, "upsert_peer"):
            try:
                self.peer_store.upsert_peer(
                    node_id=client_id,
                    callsign=client_id,
                    public_key=pubkey,
                    last_seen=int(time.time()),
                    hop_count=0
                )
            except Exception as e:
                logger.error(f"[Pairing] Failed to persist peer record: {e}")

        # Invalidate session
        self._cleanup_session(target_sess_id)

        logger.info(f"[Pairing] Successfully paired device {client_id} with role '{role}'")
        return {
            "status": "paired",
            "token": token,
            "client_id": client_id,
            "role": role,
            "capabilities": list(self.auth.ROLES.get(role, {"read"})),
            "device_pubkey": pubkey
        }

    def _cleanup_session(self, session_id: str):
        sess = self._sessions.pop(session_id, None)
        if sess and sess.get("pin") in self._pin_index:
            del self._pin_index[sess["pin"]]

    def _prune(self):
        now = time.time()
        expired = [sid for sid, data in self._sessions.items() if now > data["expires_at"]]
        for sid in expired:
            self._cleanup_session(sid)
