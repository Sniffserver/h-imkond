"""
Standardized JSON Structured Telemetry Engine for HÕIMU Pi Gateway
Outputs structured JSON log records matching standardized event categories:
- mesh.packet, mesh.route, mesh.retry, mesh.ack
- crypto.sign, crypto.decrypt
- radio.tx, radio.rx, radio.error
- map.tile, gps.fix
- storage.write, storage.error
"""

import json
import time
import logging
from typing import Dict, Any, Optional

TELEMETRY_CATEGORIES = {
    "mesh.packet", "mesh.route", "mesh.retry", "mesh.ack",
    "crypto.sign", "crypto.decrypt",
    "radio.tx", "radio.rx", "radio.error",
    "map.tile", "gps.fix",
    "storage.write", "storage.error"
}

class JSONTelemetryFormatter(logging.Formatter):
    """
    Formats Python log records as standardized JSON strings.
    """
    def __init__(self, node_id: str = "PI-GW"):
        super().__init__()
        self.node_id = node_id

    def format(self, record: logging.LogRecord) -> str:
        category = getattr(record, "category", "mesh.packet")
        if category not in TELEMETRY_CATEGORIES:
            category = "mesh.packet"

        details = getattr(record, "details", {})
        if not isinstance(details, dict):
            details = {"message": str(details)}

        payload = {
            "timestamp": int(time.time() * 1000),
            "level": record.levelname.lower(),
            "category": category,
            "node_id": self.node_id,
            "message": record.getMessage(),
            "details": details
        }

        return json.dumps(payload)

class StructuredTelemetryLogger:
    """
    Standardized Telemetry Logger wrapper for Pi Gateway.
    """
    def __init__(self, node_id: str = "PI-GW"):
        self.node_id = node_id
        self.logger = logging.getLogger("hoimu.telemetry")
        self.logger.setLevel(logging.INFO)

        handler = logging.StreamHandler()
        handler.setFormatter(JSONTelemetryFormatter(node_id=node_id))

        if not self.logger.handlers:
            self.logger.addHandler(handler)

    def log_event(self, category: str, message: str, details: Optional[Dict[str, Any]] = None, level: str = "info"):
        if category not in TELEMETRY_CATEGORIES:
            category = "mesh.packet"

        extra = {
            "category": category,
            "details": details or {}
        }

        lvl = level.lower()
        if lvl == "error":
            self.logger.error(message, extra=extra)
        elif lvl == "warn" or lvl == "warning":
            self.logger.warning(message, extra=extra)
        else:
            self.logger.info(message, extra=extra)
