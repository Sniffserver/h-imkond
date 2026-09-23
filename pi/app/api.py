"""
FastAPI REST & Diagnostics API for HÕIMU Pi Gateway
Enforces capability tokens, pairing session endpoints (/api/v1/pair/start, /api/v1/pair/confirm), and diagnostics.
"""

import time
from typing import Dict, Any, Optional

try:
    from fastapi import FastAPI, HTTPException, Header, Depends, status
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

def create_api_app(router, auth_handler, pairing_manager, sx1262_driver):
    if not HAS_FASTAPI:
        return None

    app = FastAPI(
        title="HÕIMU Pi Zero 2 W Mesh Gateway",
        version="2.1.0",
        description="Headless hardware gateway for SX1262 LoRa, BLE, and Ad-hoc Mesh Routing"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class SendPacketRequest(BaseModel):
        destination_id: str
        payload: Any
        packet_type: Optional[int] = 1
        flags: Optional[int] = 0
        signature: Optional[str] = None

    class PairStartRequest(BaseModel):
        client_id: str
        device_name: Optional[str] = None
        public_key: Optional[str] = None

    class PairConfirmRequest(BaseModel):
        session_id: Optional[str] = None
        pin: str
        client_id: str
        public_key: Optional[str] = None

    class PairRequest(BaseModel):
        client_id: str
        pin: Optional[str] = None

    def require_auth(authorization: Optional[str] = Header(None)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
        token = authorization[7:]
        payload = auth_handler.verify_token(token)
        if not payload:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired capability token")
        return payload

    @app.get("/health")
    @app.get("/status")
    def get_status():
        radio_stats = sx1262_driver.get_stats()
        return {
            "status": "online",
            "node_id": router.node_id,
            "version": "2.1.0",
            "timestamp": int(time.time()),
            "radio": radio_stats,
            "router_stats": router.stats,
            "dedup_cache_size": router.dedup.size(),
        }

    @app.get("/diagnostics")
    def get_diagnostics():
        stats = sx1262_driver.get_stats()
        return {
            "node_id": router.node_id,
            "radio": stats,
            "router": router.stats,
            "duty_cycle": {
                "rolling_hour_airtime_ms": stats.get("rolling_hour_airtime_ms", 0),
                "duty_cycle_percent": stats.get("duty_cycle_percent", 0.0),
                "quota_ms": 36000,
                "is_throttled": stats.get("duty_cycle_percent", 0.0) >= 1.0,
            }
        }

    # Standard Pairing Pipeline Endpoint 1: QR / PIN Ephemeral Session Generation
    @app.post("/api/v1/pair/start")
    def pair_start(req: PairStartRequest):
        sess = pairing_manager.generate_pairing_session(req.client_id, req.public_key)
        return {
            "status": "ok",
            "session_id": sess["session_id"],
            "dev_pin": sess["pin"],
            "qr_payload": sess["qr_payload"],
            "expires_in_seconds": pairing_manager.pin_ttl_seconds
        }

    # Standard Pairing Pipeline Endpoint 2: PIN / Device Identity Confirmation & Token Generation
    @app.post("/api/v1/pair/confirm")
    def pair_confirm(req: PairConfirmRequest):
        result = pairing_manager.complete_pairing(
            pin=req.pin,
            client_id=req.client_id,
            session_id=req.session_id,
            public_key=req.public_key
        )
        if not result:
            raise HTTPException(status_code=400, detail="Invalid, expired, or mismatched pairing request")
        return {
            "status": "ok",
            "auth_token": result["token"],
            "client_id": result["client_id"],
            "role": result["role"],
            "capabilities": result["capabilities"]
        }

    # Legacy pairing endpoint wrapper
    @app.post("/auth/pair")
    def pair_device(req: PairRequest):
        if not req.pin:
            pin = pairing_manager.generate_pairing_pin(req.client_id)
            return {"status": "pin_generated", "pin": pin, "expires_in_seconds": pairing_manager.pin_ttl_seconds}
        else:
            result = pairing_manager.complete_pairing(req.pin, req.client_id)
            if not result or not result.get("token"):
                raise HTTPException(status_code=400, detail="Invalid or expired PIN")
            return {"status": "paired", "token": result["token"], "client_id": req.client_id}

    @app.post("/packet/send")
    def send_packet(req: SendPacketRequest, auth=Depends(require_auth)):
        success = router.send_outbound(
            dest_id=req.destination_id,
            payload=req.payload,
            packet_type=req.packet_type or 1,
            flags=req.flags or 0,
            signature=req.signature
        )
        if not success:
            raise HTTPException(status_code=503, detail="Radio transmit failed (duty cycle throttled or CAD busy)")
        return {"status": "queued_or_sent", "destination": req.destination_id}

    @app.get("/packets/inbox")
    def get_inbox(limit: int = 50, auth=Depends(require_auth)):
        if router.inbox_store:
            return router.inbox_store.get_all(limit=limit)
        return []

    return app
