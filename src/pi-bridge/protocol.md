# HÕIMU Pi Bridge Protocol Specification

**Version:** `1.2.0`  
**Base Path:** `/api/v1`

---

## 1. Overview

The **HÕIMU Pi Bridge Daemon** runs on a Raspberry Pi Zero 2 W as a low-power hardware mesh gateway. It exposes a versioned REST API for:
- 868MHz SX1262 LoRa packet transmission and reception with 1% ETSI duty cycle enforcement
- 2.4GHz BLE Long Range (Coded PHY) peer discovery
- Solar PV voltage and battery telemetry monitoring (MCP3008 ADC)
- ASCII map generation for headless displays and e-Paper screens
- Mutual authentication & cryptographic Scoped Capability Tokens

---

## 2. Security Architecture & Capability Token Handshake

### 2.1. Production Boot vs Explicit Dev Mode
- **Production Mode (`dev_mode: false`, default)**:
  - Gateway boots in strict production security posture.
  - Ephemeral pairing PINs are generated using `secrets.randbelow(900000) + 100000` (cryptographically random 6-digit PIN).
  - PIN is NEVER returned in HTTP responses. It is output exclusively to the Pi's local systemd journal / physical e-Paper display for physical possession verification.
- **Explicit Dev Mode (`HOIMU_DEV_MODE=1` or `dev_mode: true` in config.json)**:
  - Enabled ONLY when explicitly configured by the developer.
  - Returns `dev_pin` in response body to facilitate rapid automated testing.

---

### 2.2. Mutual Authentication & Scoped Capability Token Flow

```
+----------------+                               +--------------------+
|  Client Device |                               |  Pi Bridge Daemon  |
|  (Phone / App) |                               |   (Zero 2 W)       |
+--------+-------+                               +---------+----------+
         |                                                 |
         |  1. POST /api/v1/pair/start                     |
         |     { client_id, public_key, device_name }      |
         +------------------------------------------------>|
         |                                                 | Generate Session Nonce
         |                                                 | & Random 6-Digit PIN
         |  2. 200 OK                                      | Display PIN on e-Paper
         |     { session_id, session_nonce, expires_in }   |
         |<------------------------------------------------+
         |                                                 |
         |  (User reads PIN from Pi physical screen)       |
         |                                                 |
         |  3. POST /api/v1/pair/confirm                   |
         |     { session_id, pin, scopes: [...] }          |
         +------------------------------------------------>|
         |                                                 | Verify PIN & Mint Signed
         |                                                 | Capability Token:
         |                                                 | hoimu_cap_<b64>.<hmac>
         |  4. 200 OK                                      |
         |     { auth_token, device_id, scope, ... }       |
         |<------------------------------------------------+
```

### 2.3. Scoped Capability Token Structure

The authenticated Bearer token format is:
`hoimu_cap_<base64url(payload)>.<hmac_sha256_signature>`

Decoded Payload:
```json
{
  "token_type": "hoimu_capability_token",
  "v": 1,
  "deviceId": "dev-4a2b8e",
  "clientId": "HOIMU-CLIENT-APP",
  "keyId": "key_0x8f2a1b9c",
  "scope": [
    "mesh.read",
    "mesh.send",
    "telemetry.read"
  ],
  "issuedAt": 1790110000000,
  "expiresAt": 1792702000000
}
```

### 2.4. Capability Scopes & RBAC Matrix

| Scope | Allowed Operations & Endpoints |
| :--- | :--- |
| `mesh.read` | `/api/v1/peers`, `/api/v1/map/ascii`, commands: `scan`, `ascii_map`, `sync_peers` |
| `mesh.send` | `/api/v1/broadcast`, `/mesh/broadcast`, commands: `broadcast` |
| `telemetry.read` | `/api/v1/status`, `/telemetry`, commands: `status` |
| `config.admin` | `/api/v1/config` (mutates only whitelisted operational params) |
| `device.admin` | Super-admin scope: `/api/v1/config`, `/api/v1/devices/revoke` |

---

### 2.5. Configuration Hardening & Parameter Whitelist (`/api/v1/config`)
To eliminate arbitrary remote daemon compromise, `/api/v1/config` is strictly restricted to `config.admin` or `device.admin` scopes, and only allows mutating a safe operational parameter whitelist:
- `relay_cadence_sec` (integer)
- `solar_threshold_watts` (float / int)
- `night_sleep_multiplier` (float / int)
- `grid_cols` (integer)
- `grid_rows` (integer)
- `grid_scale_m` (float / int)
- `eink_enabled` (boolean)

All attempts to modify core system parameters (`host`, `port`, `dev_mode`, `radio_modules`, `lora_config`, `auth_token`, `allowed_commands`, `spi_bus`, `spi_device`) are immediately rejected with `403 Forbidden` (`FORBIDDEN_PARAMETER`).

---

### 2.6. Production GPS Hardware Boundary (`set_gps`)
- In **Production (`DEV_MODE=False`)**, GPS coordinates are acquired exclusively from hardware (physical serial / UART NMEA GPS module).
- The `set_gps` command is strictly disabled in production mode (`403 Forbidden`).
- The `set_gps` simulator command is enabled only when `HOIMU_DEV_MODE=1` is explicitly set in the daemon environment.

---

## 3. Rate Limiting & Hashed Logging

- **Hashed Log Tracing**: The daemon hashes client identifiers and tokens using SHA-256 (`hashlib.sha256`) and logs truncated `client_hash` (`a1b2c3d4e5f6`) in structured JSON stdout logs. Raw secrets and tokens are never logged.
- **Rate Limits**:
  - Pairing Endpoints (`/api/v1/pair/start`, `/api/v1/pair/confirm`): Max 5 requests/min per IP.
  - Auth Failures (`401 Unauthorized`): Max 10 failures/min per IP before returning `429 Too Many Requests`.
  - SOS Broadcast Commands (`type == "sos"`): Max 5 broadcasts/min per device.
  - Hardware Scan Command (`scan`): Max 10 scans/min per device.

---

## 4. REST API Reference

### Public Endpoints
- `GET /health` or `GET /api/v1/health`
- `POST /api/v1/pair/start`
- `POST /api/v1/pair/confirm`

### Authenticated Endpoints (Bearer Capability Token Required)
- `POST /api/v1/devices/revoke`
- `GET /api/v1/status` (requires `telemetry.read`)
- `GET /api/v1/peers` (requires `mesh.read`)
- `POST /api/v1/broadcast` (requires `mesh.send`)
- `POST /api/v1/command` (enforces per-command scopes)
- `GET /api/v1/map/ascii` (requires `mesh.read`)
- `POST /api/v1/config` (requires `device.admin`)
