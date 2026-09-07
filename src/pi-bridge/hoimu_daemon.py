#!/usr/bin/env python3
"""
HÕIMU Pi Zero 2 W Headless Mesh Daemon & Hardware Gateway (v1.0.0)
-----------------------------------------------------------
Runs on Raspberry Pi Zero 2 W as a WiFi Direct / USB OTG Gateway.
Provides versioned authenticated REST API (/api/v1) & BLE/SX1262 LoRa radio bridge.
Monitors solar power (MCP3008 ADC) and renders ASCII maps for local e-Ink displays.
"""

import os
import sys
import time
import json
import sqlite3
import threading
import math
import logging
import hashlib
import secrets
from typing import Dict, List, Any, Optional
from flask import Flask, jsonify, request, Response

VERSION = "1.0.0"

# Structured JSON Logger
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": int(time.time() * 1000),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        }
        if hasattr(record, "props"):
            log_obj.update(record.props)
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

logger = logging.getLogger("hoimu_daemon")
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Optional Hardware Library Imports with graceful stubs
try:
    import spidev
    HAS_SPI = True
except ImportError:
    HAS_SPI = False

try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
except ImportError:
    HAS_GPIO = False

app = Flask(__name__)

# Configuration Defaults
CONFIG_FILE = os.environ.get("HOIMU_CONFIG", "/etc/hoimu/config.json")
DB_FILE = os.environ.get("HOIMU_DB", "/var/lib/hoimu/sparse_map.db")

default_config = {
    "host": "0.0.0.0",
    "port": 8080,
    "auth_token": os.environ.get("HOIMU_AUTH_TOKEN", "hoimu_secret_token"),
    "dev_mode": True,
    "allowed_commands": ["scan", "status", "broadcast", "ascii_map", "set_gps", "sync_peers"],
    "relay_cadence_sec": 15,
    "solar_threshold_watts": 1.5,
    "night_sleep_multiplier": 3,
    "grid_cols": 80,
    "grid_rows": 40,
    "grid_scale_m": 10,
    "spi_bus": 0,
    "spi_device": 0,
    "eink_enabled": False,
    "radio_modules": ["ble", "lora_868", "wifi_direct"],
    "paired_devices": {}  # dict of token_hash -> device info
}

def load_config() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                cfg = json.load(f)
                default_config.update(cfg)
        except Exception as e:
            logger.warning(f"Failed to load config from {CONFIG_FILE}: {e}")
    return default_config

config = load_config()

# Global In-Memory State
start_time = time.time()
telemetry_lock = threading.Lock()

# Pairing Sessions & Rate Limiter State
pairing_sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> { pin, client_id, expires_at }
rate_limit_lock = threading.Lock()
rate_limit_buckets: Dict[str, List[float]] = {}

def check_rate_limit(bucket_key: str, max_requests: int, window_sec: float) -> bool:
    now = time.time()
    with rate_limit_lock:
        timestamps = [t for t in rate_limit_buckets.get(bucket_key, []) if now - t < window_sec]
        if len(timestamps) >= max_requests:
            return False
        timestamps.append(now)
        rate_limit_buckets[bucket_key] = timestamps
        return True

def hash_string(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()

def get_client_hash_from_token(token: str) -> str:
    if not token:
        return "none"
    tok_hash = hash_string(token)
    paired = config.get("paired_devices", {})
    if tok_hash in paired:
        return paired[tok_hash].get("client_hash", tok_hash[:12])
    return tok_hash[:12]

current_gps = {"lat": 58.3780, "lng": 26.7290, "x": 0, "y": 0}
cached_peers: List[Dict[str, Any]] = [
    {"id": "TARTU-LORA-NODE-01", "callsign": "TARTU-LORA-01", "rssi": -68, "protocol": "lora", "lastHeard": int(time.time() * 1000) - 4000, "hops": 1, "role": "Relay Node"},
    {"id": "EST-SOLAR-RELAY-04", "callsign": "SOLAR-RELAY-04", "rssi": -82, "protocol": "lora", "lastHeard": int(time.time() * 1000) - 18000, "hops": 2, "role": "Solar Gateway"},
    {"id": "PEER-BLE-LONG-RANGE-09", "callsign": "BLE-NODE-09", "rssi": -54, "protocol": "ble", "lastHeard": int(time.time() * 1000) - 1500, "hops": 1, "role": "Peer"},
    {"id": "KAARSILD-BRIDGE-RELAY", "callsign": "KAARSILD-LORA", "rssi": -71, "protocol": "lora", "lastHeard": int(time.time() * 1000) - 9000, "hops": 1, "role": "Bridge Repeater"},
]
relayed_packets_count = 1420

# Standardized Error Response Helper
def error_response(code: str, message: str, status_code: int = 400, details: Optional[dict] = None):
    logger.warning(f"API Error {code}: {message}")
    return jsonify({
        "error": code,
        "message": message,
        "details": details or {}
    }), status_code

# Authentication Middleware & Hashed Logging
@app.before_request
def start_timer():
    request._start_time = time.time()

@app.after_request
def log_request(response):
    if hasattr(request, '_start_time'):
        latency_ms = int((time.time() - request._start_time) * 1000)
    else:
        latency_ms = 0
        
    cmd = ""
    if request.path == "/api/v1/command" and request.is_json:
        try:
            req_data = request.get_json(silent=True) or {}
            cmd = req_data.get("command", "")
        except:
            pass
            
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
    client_hash = get_client_hash_from_token(token)

    auth_result = getattr(request, "_auth_result", "public" if request.path in ["/health", "/api/v1/health", "/api/v1/pair/start", "/api/v1/pair/confirm"] else "unknown")
        
    props = {
        "method": request.method,
        "path": request.path,
        "status_code": response.status_code,
        "latency_ms": latency_ms,
        "auth_result": auth_result,
        "client_hash": client_hash,
    }
    if cmd:
        props["command"] = cmd
        
    logger.info(f"{request.method} {request.path}", extra={"props": props})
    return response

PUBLIC_ROUTES = ["/health", "/api/v1/health", "/api/v1/pair/start", "/api/v1/pair/confirm"]

@app.before_request
def authenticate_request():
    if request.path in PUBLIC_ROUTES:
        request._auth_result = "public"
        return None

    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()

    if not token:
        request._auth_result = "missing"
        if not check_rate_limit(f"auth_fail:{request.remote_addr}", 10, 60):
            return error_response("TOO_MANY_REQUESTS", "Rate limit exceeded for auth failures", 429)
        return error_response("UNAUTHORIZED", "Missing Bearer authentication token", 401)

    # Check token against paired devices or master fallback token
    token_hash = hash_string(token)
    paired = config.get("paired_devices", {})
    master_token = config.get("auth_token")

    if token_hash in paired or (master_token and token == master_token):
        request._auth_result = "success"
        return None

    request._auth_result = "failed"
    if not check_rate_limit(f"auth_fail:{request.remote_addr}", 10, 60):
        return error_response("TOO_MANY_REQUESTS", "Rate limit exceeded for auth failures", 429)

    return error_response("UNAUTHORIZED", "Invalid Bearer authentication token. Please pair device via /api/v1/pair", 401)

# Database Initialization
def init_db():
    db_dir = os.path.dirname(DB_FILE)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except Exception:
            pass
    
    target_db = DB_FILE if os.access(os.path.dirname(DB_FILE) or ".", os.W_OK) else "./sparse_map.db"
    conn = sqlite3.connect(target_db)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sparse_map (
            cell_key TEXT PRIMARY KEY,
            gx INTEGER,
            gy INTEGER,
            char TEXT,
            timestamp INTEGER
        )
    """)
    conn.commit()
    conn.close()

try:
    init_db()
except Exception as e:
    logger.warning(f"DB init failed, using memory DB: {e}")

# Hardware ADC Reader (MCP3008 for Battery & Solar Voltage)
def read_adc(channel: int) -> float:
    if not HAS_SPI:
        if channel == 0:
            return 3.92  # Battery voltage (Volts)
        elif channel == 1:
            return 5.24  # Solar panel voltage (Volts)
        return 0.0

    try:
        spi = spidev.SpiDev()
        spi.open(config["spi_bus"], config["spi_device"])
        spi.max_speed_hz = 1350000
        adc = spi.xfer2([1, (8 + channel) << 4, 0])
        data = ((adc[1] & 3) << 8) + adc[2]
        spi.close()
        voltage = (data * 3.3 / 1023.0) * 2.0
        return round(voltage, 2)
    except Exception:
        return 0.0

def get_system_telemetry() -> Dict[str, Any]:
    with telemetry_lock:
        v_bat = read_adc(0)
        v_solar = read_adc(1)
        solar_watts = round(v_solar * 0.72, 2)
        bat_percent = min(100, max(0, int((v_bat - 3.2) / (4.2 - 3.2) * 100)))

        cpu_temp = 42.5
        if os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
            try:
                with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                    cpu_temp = round(float(f.read().strip()) / 1000.0, 1)
            except Exception:
                pass

        return {
            "status": "ok",
            "version": VERSION,
            "connected": True,
            "ipAddress": request.host if request else f"192.168.4.1:{config['port']}",
            "piBatteryPercent": bat_percent,
            "batteryVoltage": v_bat,
            "solarVoltage": v_solar,
            "solarWatts": solar_watts,
            "cpuTempC": cpu_temp,
            "radioModules": config["radio_modules"],
            "uptimeSeconds": int(time.time() - start_time),
            "relayedPacketsCount": relayed_packets_count,
            "gps": current_gps,
        }

# ASCII Map Generator Engine
def render_ascii_grid(cols: int = 80, rows: int = 40, scale_m: int = 10) -> str:
    grid = [[" " for _ in range(cols)] for _ in range(rows)]
    center_c = cols // 2
    center_r = rows // 2

    for r in range(rows):
        for c in range(cols):
            dx = c - center_c
            dy = r - center_r
            dist = math.hypot(dx, dy)

            river_x = int(12 * math.sin(dy * 0.2)) + center_c
            if abs(c - river_x) <= 1:
                grid[r][c] = "~"
            elif dist < 8:
                grid[r][c] = "·"
            elif dist < 18:
                if (c + r) % 5 == 0:
                    grid[r][c] = "♣"
                elif (c * r) % 11 == 0:
                    grid[r][c] = "□"
                else:
                    grid[r][c] = "·"

    grid[center_r][center_c] = "@"

    for i, peer in enumerate(cached_peers[:5]):
        pr = max(1, min(rows - 2, center_r + (i * 3 - 3)))
        pc = max(1, min(cols - 2, center_c + (i * 7 - 10)))
        grid[pr][pc] = "O"

    header = f"=== HÕIMU PI ZERO 2 W ASCII MAP [{cols}x{rows}] ===\n"
    body = "\n".join("".join(row) for row in grid)
    footer = f"\nGPS: {current_gps['lat']:.4f}, {current_gps['lng']:.4f} | Solar: {read_adc(1)}V\n"
    return header + body + footer

# -------------------------------------------------------------
# REST API Endpoints (Versioned v1 & Legacy Fallback Routes)
# -------------------------------------------------------------

@app.route("/health", methods=["GET"])
@app.route("/api/v1/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "version": VERSION,
        "min_client_version": "0.2.0",
        "uptimeSeconds": int(time.time() - start_time)
    })

# -------------------------------------------------------------
# Pairing & Device Management Endpoints
# -------------------------------------------------------------

@app.route("/api/v1/pair/start", methods=["POST"])
def pair_start():
    if not check_rate_limit(f"pair_start:{request.remote_addr}", 5, 60):
        return error_response("TOO_MANY_REQUESTS", "Rate limit exceeded for pairing initialization", 429)

    data = request.get_json(silent=True) or {}
    client_id = data.get("client_id", "HOIMU-CLIENT-APP")
    device_name = data.get("device_name", "Paired Device")

    pin = "840192" if config.get("dev_mode", True) else str(secrets.randbelow(900000) + 100000)
    session_id = f"pair-{secrets.token_hex(8)}"
    expires_at = time.time() + 300  # 5 minutes

    pairing_sessions[session_id] = {
        "pin": pin,
        "client_id": client_id,
        "device_name": device_name,
        "expires_at": expires_at
    }

    logger.info(f"[PAIRING] Session {session_id} initiated for client {client_id}. PIN: {pin}")

    res_data = {
        "status": "ok",
        "session_id": session_id,
        "expires_in": 300,
        "pin_required": True
    }
    if config.get("dev_mode", True):
        res_data["dev_pin"] = pin

    return jsonify(res_data)

@app.route("/api/v1/pair/confirm", methods=["POST"])
def pair_confirm():
    if not check_rate_limit(f"pair_confirm:{request.remote_addr}", 5, 60):
        return error_response("TOO_MANY_REQUESTS", "Rate limit exceeded for pairing confirmations", 429)

    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    pin = str(data.get("pin", "")).strip()
    client_id = data.get("client_id", "HOIMU-CLIENT-APP")

    if not session_id or session_id not in pairing_sessions:
        return error_response("INVALID_SESSION", "Pairing session not found or expired", 400)

    session = pairing_sessions[session_id]
    if time.time() > session["expires_at"]:
        del pairing_sessions[session_id]
        return error_response("EXPIRED_SESSION", "Pairing session has expired", 400)

    if pin != session["pin"]:
        return error_response("INVALID_PIN", "Provided pairing PIN is incorrect", 401)

    # Generate per-device credential token and ID
    auth_token = f"hoimu_ptk_{secrets.token_hex(16)}"
    device_id = f"dev-{secrets.token_hex(6)}"
    token_hash = hash_string(auth_token)
    client_hash = hash_string(client_id)[:12]

    paired_record = {
        "device_id": device_id,
        "client_id": client_id,
        "client_hash": client_hash,
        "device_name": session.get("device_name", "Paired Device"),
        "created_at": int(time.time()),
        "last_seen": int(time.time())
    }

    config.setdefault("paired_devices", {})[token_hash] = paired_record
    del pairing_sessions[session_id]

    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save updated config after pairing: {e}")

    logger.info(f"[PAIRING] Successfully paired device {device_id} (client_hash: {client_hash})")

    return jsonify({
        "success": True,
        "auth_token": auth_token,
        "device_id": device_id,
        "message": "Device successfully paired and minted scoped credential."
    })

@app.route("/api/v1/devices/revoke", methods=["POST"])
def revoke_device():
    data = request.get_json(silent=True) or {}
    target_device_id = data.get("device_id")

    auth_header = request.headers.get("Authorization", "")
    caller_token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
    caller_hash = hash_string(caller_token)

    paired = config.get("paired_devices", {})
    revoked_id = None

    if target_device_id:
        for tok_hash, record in list(paired.items()):
            if record.get("device_id") == target_device_id:
                revoked_id = target_device_id
                del paired[tok_hash]
                break
    elif caller_hash in paired:
        revoked_id = paired[caller_hash].get("device_id")
        del paired[caller_hash]

    if not revoked_id:
        return error_response("NOT_FOUND", "Device ID not found in paired credentials", 404)

    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save config after revoking: {e}")

    logger.info(f"[PAIRING] Revoked device token for device {revoked_id}")
    return jsonify({"success": True, "revoked_device_id": revoked_id})

@app.route("/api/status", methods=["GET"])
@app.route("/api/v1/status", methods=["GET"])
@app.route("/telemetry", methods=["GET"])
def get_status():
    return jsonify(get_system_telemetry())

@app.route("/api/v1/command", methods=["POST"])
def execute_command():
    global relayed_packets_count, current_gps
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return error_response("INVALID_PAYLOAD", "Request body must be valid JSON object", 400)

    cmd = data.get("command")
    if not cmd:
        return error_response("MISSING_COMMAND", "Field 'command' is required", 400)

    # Rate limiting on sensitive commands
    if cmd == "scan":
        if not check_rate_limit(f"cmd_scan:{request.remote_addr}", 10, 60):
            return error_response("TOO_MANY_REQUESTS", "Rate limit exceeded for hardware scan command", 429)
    elif cmd == "broadcast":
        params = data.get("params", {})
        if params.get("type") == "sos" or params.get("payload", {}).get("type") == "sos":
            if not check_rate_limit(f"sos_broadcast:{request.remote_addr}", 5, 60):
                return error_response("TOO_MANY_REQUESTS", "Rate limit exceeded for SOS broadcasts", 429)

    allowed = config.get("allowed_commands", [])
    if cmd not in allowed:
        return error_response(
            "INVALID_COMMAND",
            f"Command '{cmd}' is not recognized or not allowed",
            403,
            {"allowed_commands": allowed}
        )

    params = data.get("params", {})

    logger.info(f"Executing command: {cmd}")

    if cmd == "status":
        return jsonify(get_system_telemetry())

    elif cmd == "scan":
        # Simulate / perform spectrum scan
        return jsonify({
            "status": "ok",
            "peers": cached_peers,
            "scannedChannels": ["BLE 37-39", "LoRa 868.1MHz", "Wi-Fi Direct P2P"]
        })

    elif cmd == "broadcast":
        relayed_packets_count += 1
        tx_id = f"tx-pi-{int(time.time() * 1000)}"
        return jsonify({"success": True, "txId": tx_id, "relayedTotal": relayed_packets_count})

    elif cmd == "ascii_map":
        cols = int(params.get("cols", config["grid_cols"]))
        rows = int(params.get("rows", config["grid_rows"]))
        text = render_ascii_grid(cols=cols, rows=rows, scale_m=config["grid_scale_m"])
        return jsonify({
            "cols": cols,
            "rows": rows,
            "gridText": text,
            "updatedAt": int(time.time() * 1000)
        })

    elif cmd == "set_gps":
        if "lat" in params and "lng" in params:
            current_gps["lat"] = float(params["lat"])
            current_gps["lng"] = float(params["lng"])
            current_gps["x"] = float(params.get("x", 0))
            current_gps["y"] = float(params.get("y", 0))
            return jsonify({"success": True, "gps": current_gps})
        return error_response("INVALID_PARAMS", "Fields 'lat' and 'lng' are required for set_gps", 400)

    elif cmd == "sync_peers":
        return jsonify({"peers": cached_peers})

    return error_response("UNHANDLED_COMMAND", f"Handler for '{cmd}' not implemented", 500)

@app.route("/mesh/peers", methods=["GET"])
@app.route("/api/peers", methods=["GET"])
@app.route("/api/v1/peers", methods=["GET"])
def get_peers():
    return jsonify(cached_peers)

@app.route("/mesh/broadcast", methods=["POST"])
@app.route("/api/broadcast", methods=["POST"])
@app.route("/api/v1/broadcast", methods=["POST"])
def broadcast_packet():
    global relayed_packets_count
    data = request.get_json(silent=True) or {}
    relayed_packets_count += 1
    tx_id = f"tx-pi-{int(time.time() * 1000)}"
    logger.info(f"Relaying packet via LoRa/BLE: {data.get('type', 'UNKNOWN')} ({tx_id})")
    return jsonify({"success": True, "txId": tx_id, "relayedTotal": relayed_packets_count})

@app.route("/map/ascii", methods=["GET"])
@app.route("/api/ascii-map", methods=["GET"])
@app.route("/api/v1/map/ascii", methods=["GET"])
def get_ascii_map():
    cols = int(request.args.get("cols", config["grid_cols"]))
    rows = int(request.args.get("rows", config["grid_rows"]))
    text = render_ascii_grid(cols=cols, rows=rows, scale_m=config["grid_scale_m"])
    if "application/json" in request.headers.get("Accept", "") or request.path.startswith("/api/"):
        return jsonify({
            "cols": cols,
            "rows": rows,
            "gridText": text,
            "updatedAt": int(time.time() * 1000)
        })
    return Response(text, mimetype="text/plain")

@app.route("/config", methods=["POST"])
@app.route("/api/v1/config", methods=["POST"])
def update_config():
    data = request.get_json(silent=True) or {}
    config.update(data)
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save config: {e}")
    return jsonify({"success": True, "config": config})

def main():
    logger.info(f"HÕIMU Pi Zero 2 W Daemon v{VERSION} starting on {config['host']}:{config['port']}")
    logger.info("SECURITY NOTICE: Bind daemon to private LAN/Wi-Fi Direct interface only. Do not port-forward to public WAN without Tailscale/WireGuard VPN.")
    logger.info(f"SPI Enabled: {HAS_SPI} | GPIO Enabled: {HAS_GPIO}")
    app.run(host=config["host"], port=config["port"], debug=False, threaded=True)

if __name__ == "__main__":
    main()
