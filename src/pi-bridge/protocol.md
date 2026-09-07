# HÕIMU Pi Bridge Protocol Specification

**Version:** `1.0.0`  
**Base Path:** `/api/v1`

---

## 1. Overview

The **HÕIMU Pi Bridge Daemon** runs on a Raspberry Pi Zero 2 W as a low-power hardware mesh gateway. It exposes a versioned REST API for:
- 868MHz SX1262 LoRa packet transmission and reception
- 2.4GHz BLE Long Range (Coded PHY) peer discovery
- Solar PV voltage and battery telemetry monitoring (MCP3008 ADC)
- ASCII map generation for headless displays and e-Paper screens

---

## 2. Authentication & Device Pairing

To prevent client bundle token leakage in client web and Capacitor builds (`VITE_` prefix values are public), client applications pass a non-secret identifier (`VITE_PI_BRIDGE_CLIENT_ID`, e.g. `HOIMU-CLIENT-APP`) and retrieve dynamic per-device credentials via a 2-step PIN pairing protocol.

### 2.1. Dynamic 2-Step PIN Pairing Flow

1. **Initiate Session (`POST /api/v1/pair/start`)**
   - **Public Endpoint** (Rate-limited to 5 requests/min per IP)
   - **Request Body:**
     ```json
     {
       "client_id": "HOIMU-CLIENT-APP",
       "device_name": "Pixel 8 Pro"
     }
     ```
   - **Response `200 OK`:**
     ```json
     {
       "status": "ok",
       "session_id": "pair-a1b2c3d4e5f67890",
       "expires_in": 300,
       "pin_required": true,
       "dev_pin": "840192" // Provided in dev_mode only; production logs to Pi terminal/systemd
     }
     ```

2. **Confirm PIN & Mint Scoped Credential (`POST /api/v1/pair/confirm`)**
   - **Public Endpoint** (Rate-limited to 5 requests/min per IP)
   - **Request Body:**
     ```json
     {
       "session_id": "pair-a1b2c3d4e5f67890",
       "pin": "840192",
       "client_id": "HOIMU-CLIENT-APP"
     }
     ```
   - **Response `200 OK`:**
     ```json
     {
       "success": true,
       "auth_token": "hoimu_ptk_a9b8c7d6e5f43210...",
       "device_id": "dev-f1e2d3",
       "message": "Device successfully paired and minted scoped credential."
     }
     ```
   - **Response `401 Unauthorized`:**
     ```json
     {
       "error": "INVALID_PIN",
       "message": "Provided pairing PIN is incorrect",
       "details": {}
     }
     ```

3. **Revoke Device Credential (`POST /api/v1/devices/revoke`)**
   - **Auth:** Bearer token required
   - **Request Body:**
     ```json
     {
       "device_id": "dev-f1e2d3"
     }
     ```
   - **Response `200 OK`:**
     ```json
     {
       "success": true,
       "revoked_device_id": "dev-f1e2d3"
     }
     ```

---

## 3. Rate Limiting & Hashed Logging Security

- **Hashed Log Tracing:** The daemon hashes client identifiers and device tokens using SHA-256 (`hashlib.sha256`) and logs truncated `client_hash` (`a1b2c3d4e5f6`) in JSON stdout logs. Raw Bearer tokens are NEVER logged to disk or console.
- **Rate Limits:**
  - Pairing Endpoints (`/api/v1/pair/start`, `/api/v1/pair/confirm`): Max 5 requests/min per IP.
  - Auth Failures (`401 Unauthorized`): Max 10 failures/min per IP before returning `429 Too Many Requests`.
  - SOS Broadcast Commands (`type == "sos"`): Max 5 broadcasts/min per device.
  - Hardware Scan Command (`scan`): Max 10 scans/min per device.
- **Interface Binding Notice:** Daemon MUST bind to private P2P / LAN / USB OTG interfaces (`192.168.4.1`, `10.42.0.1`). Direct public WAN binding is strictly forbidden without Tailscale or WireGuard VPN tunnels.

---

## 4. Standard Error Envelope

When an error occurs, responses use standard JSON error envelopes with appropriate HTTP status codes:

```json
{
  "error": "INVALID_COMMAND",
  "message": "Unknown or disallowed command 'reboot'",
  "details": {
    "allowed_commands": ["scan", "status", "broadcast", "ascii_map", "set_gps", "sync_peers"]
  }
}
```

---

## 4. Endpoints

### 4.1. Health Check (Unauthenticated)
- **Method:** `GET`
- **Route:** `/api/v1/health` (also aliased to `/health`)
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "min_client_version": "0.2.0",
  "uptimeSeconds": 18450
}
```

---

### 4.2. Current Daemon & Hardware Status
- **Method:** `GET`
- **Route:** `/api/v1/status` (also aliased to `/telemetry`)
- **Auth:** Bearer token required
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "connected": true,
  "ipAddress": "192.168.4.1:8080",
  "piBatteryPercent": 87,
  "batteryVoltage": 3.92,
  "solarVoltage": 14.2,
  "solarWatts": 12.4,
  "cpuTempC": 42.5,
  "radioModules": ["ble", "lora_868", "wifi_direct"],
  "uptimeSeconds": 18450,
  "relayedPacketsCount": 421,
  "gps": {
    "lat": 58.3780,
    "lng": 26.7290,
    "x": 0,
    "y": 0
  }
}
```

---

### 4.3. Universal Command Execution
- **Method:** `POST`
- **Route:** `/api/v1/command`
- **Auth:** Bearer token required
- **Request Body:**
```json
{
  "command": "scan" | "status" | "broadcast" | "ascii_map" | "set_gps" | "sync_peers",
  "params": {}
}
```

#### Supported Commands & Parameters:

1. **`scan`**:
   - `params`: `{ "timeoutMs": 1500 }`
   - Returns: `{ "peers": [...], "scannedChannels": ["BLE 37-39", "LoRa 868.1MHz"] }`

2. **`broadcast`**:
   - `params`: `{ "type": "chat", "from": "TAMM-01", "to": "KASK-02", "payload": "..." }`
   - Returns: `{ "success": true, "txId": "tx-pi-1725700000000", "relayedTotal": 422 }`

3. **`ascii_map`**:
   - `params`: `{ "cols": 80, "rows": 40 }`
   - Returns: `{ "cols": 80, "rows": 40, "gridText": "...", "updatedAt": 1725700000000 }`

4. **`set_gps`**:
   - `params`: `{ "lat": 58.3780, "lng": 26.7290 }`
   - Returns: `{ "success": true, "gps": { ... } }`

5. **`sync_peers`**:
   - `params`: `{}`
   - Returns: `{ "peers": [...] }`

---

### 4.4. Peers Listing
- **Method:** `GET`
- **Route:** `/api/v1/peers` (aliased to `/mesh/peers`)
- **Auth:** Bearer token required
- **Response `200 OK`:**
```json
[
  {
    "id": "TARTU-LORA-NODE-01",
    "callsign": "TARTU-LORA-01",
    "rssi": -68,
    "protocol": "lora",
    "lastHeard": 1725699996000,
    "hops": 1,
    "role": "Relay Node"
  }
]
```

---

### 4.5. ASCII Map Text Grid
- **Method:** `GET`
- **Route:** `/api/v1/map/ascii`
- **Auth:** Bearer token required
- **Query Params:** `?cols=80&rows=40`
- **Response:** `text/plain` or JSON
