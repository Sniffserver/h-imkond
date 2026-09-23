"""
Security & Token Authentication Subsystem for HÕIMU Pi Gateway
Scoped capability tokens with HMAC-SHA256 signatures and constant-time verification.
"""

import hmac
import hashlib
import base64
import json
import time
import secrets
from typing import Optional, Dict, List, Set, Any

DEFAULT_DEV_SECRET = "hoimu_local_gateway_shared_master_key_v2"

class CapabilityAuth:
    ROLES = {
        "admin": {"read", "send", "relay", "config", "reboot"},
        "operator": {"read", "send", "relay"},
        "viewer": {"read"},
        "sensor": {"send"},
    }

    def __init__(self, master_secret: str = DEFAULT_DEV_SECRET):
        self.master_secret = master_secret.encode('utf-8')

    def generate_token(self, subject: str, role: str = "operator", ttl_seconds: int = 86400) -> str:
        """
        Generates a signed, scoped bearer token: Base64(payload).Base64(signature)
        """
        now = int(time.time())
        capabilities = list(self.ROLES.get(role, {"read"}))
        payload = {
            "sub": subject,
            "role": role,
            "caps": capabilities,
            "iat": now,
            "exp": now + ttl_seconds,
            "nonce": secrets.token_hex(4)
        }
        payload_bytes = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
        payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8').rstrip('=')

        sig = hmac.new(self.master_secret, payload_b64.encode('utf-8'), hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')

        return f"{payload_b64}.{sig_b64}"

    def verify_token(self, token_str: str, required_capability: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Verifies token cryptographic signature, expiry, and capability in constant time.
        """
        if not token_str or "." not in token_str:
            return None

        parts = token_str.split(".")
        if len(parts) != 2:
            return None

        payload_b64, sig_b64 = parts

        # Verify signature
        expected_sig = hmac.new(self.master_secret, payload_b64.encode('utf-8'), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode('utf-8').rstrip('=')

        if not hmac.compare_digest(expected_sig_b64, sig_b64):
            return None

        # Decode and verify payload
        try:
            padded_b64 = payload_b64 + '=' * (-len(payload_b64) % 4)
            payload_bytes = base64.urlsafe_b64decode(padded_b64)
            payload = json.loads(payload_bytes.decode('utf-8'))
        except Exception:
            return None

        # Expiry check
        if time.time() > payload.get("exp", 0):
            return None

        # Capability check
        if required_capability:
            caps = set(payload.get("caps", []))
            if required_capability not in caps and "admin" != payload.get("role"):
                return None

        return payload
