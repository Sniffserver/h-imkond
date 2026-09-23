# HÕIMU Raspberry Pi Zero 2 W Hardware Gateway Specification

The **HÕIMU Pi Bridge** is a low-power, solar-assisted headless mesh radio relay daemon running on Raspberry Pi Zero 2 W hardware. It bridges smartphones (via WiFi Direct or USB OTG Ethernet) to SX1262/SX1276 868MHz LoRa long-range radio hardware and BLE long-range Coded PHY nodes.

---

## 1. Hardware Circuit & Wiring Diagram

```
                 +---------------------------------------+
                 |       Raspberry Pi Zero 2 W           |
                 |                                       |
                 |  3V3 (Pin 1) ----- VCC                |
                 |  GND (Pin 6) ----- GND                |
                 |  GPIO10 (SPI0_MOSI) - MOSI            |
                 |  GPIO9  (SPI0_MISO) - MISO            |
                 |  GPIO11 (SPI0_SCLK) - SCLK            |
                 |  GPIO8  (SPI0_CE0)  - CS              |
                 +-------------------+-------------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
+------------------------+                      +------------------------+
| MCP3008 SPI ADC        |                      | Waveshare 2.13" e-Paper|
| CH0: Battery (Divider) |                      | BUSY:  GPIO24          |
| CH1: Solar PV Input    |                      | RST:   GPIO17          |
+------------------------+                      | DC:    GPIO25          |
                                                | CS:    GPIO8 (CE0)     |
                                                +------------------------+
```

### Component Pinout Summary
1. **MCP3008 SPI ADC (Voltage Measurement)**:
   - **CH0**: Battery voltage connected via 100kΩ / 100kΩ divider (2x attenuation factor).
   - **CH1**: Solar panel PV input voltage (0–10V reduced to 0–3.3V range).
2. **SX1262 868MHz SPI LoRa Radio**:
   - SPI0 bus (`/dev/spidev0.0`)
   - Reset: GPIO18 | BUSY: GPIO22 | DIO1: GPIO23
3. **Waveshare 2.13" e-Paper HAT**:
   - Local rendering of text/plain ASCII bioregional map (`/map/ascii`).

---

## 2. Radio Hardware Abstraction Layer (HAL) & RF Features

- **EU868 Spectrum Scanner**: Actively samples 868.1, 868.3, 868.5, and 869.525 MHz ISM channels, measuring real RSSI noise floors and preamble triggers.
- **Airtime & Duty Cycle Tracker**: Calculates exact packet Time-on-Air (ToA) using Semtech SX126x equations and enforces the ETSI EN 300 220 1% duty cycle limit (max 36s airtime per sliding 1-hour window).
- **CSMA / CAD (Channel Activity Detection)**: Verifies RF channel state prior to transmission, applying random backoff to avoid in-air packet collisions.
- **Dynamic Peer Discovery**: Real-time OTA packet parsing populates and ages out active mesh nodes with real RSSI, SNR, frequency, and hop telemetry.

---

## 3. Production Security & Credential Model

### No Hardcoded Master Secrets
All static master secrets are removed from repository config files. Configuration is strictly separated:
- **Operational parameters**: `/etc/hoimu/config.json` (host, port, RF frequencies, grid settings).
- **Secrets & Salts**: `/etc/hoimu/secret.env` (`chmod 600`, loaded by systemd via `EnvironmentFile=-/etc/hoimu/secret.env`).
- **Paired Client Credentials**: `/var/lib/hoimu/paired_devices.json` (`chmod 600`).

### Dynamic Device Pairing Flow
1. App initiates pairing: `POST /api/v1/pair/start` (returns ephemeral session ID & requires 6-digit PIN).
2. User enters physical PIN on device: `POST /api/v1/pair/confirm`.
3. Daemon mints a scoped, per-device token (`hoimu_ptk_<hex>`) and registers the device hash.
4. App authenticates subsequent calls using `Authorization: Bearer hoimu_ptk_<hex>`.

---

## 4. REST API Endpoints

| Method | Endpoint | Description | Auth & Security |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` / `/api/v1/health` | Public health & radio hardware status | Unauthenticated |
| `POST` | `/api/v1/pair/start` | Start 2-step PIN pairing | Rate limited (5/min), Public |
| `POST` | `/api/v1/pair/confirm` | Confirm 6-digit PIN & mint token | Rate limited (5/min), Public |
| `POST` | `/api/v1/devices/revoke` | Revoke device pairing credential | Bearer Auth Required |
| `GET` | `/api/v1/status` / `/telemetry` | System, solar, battery, & duty-cycle telemetry | Bearer Auth Required |
| `GET` | `/api/v1/peers` / `/mesh/peers` | Discovered live BLE / LoRa nodes | Bearer Auth Required |
| `POST` | `/api/v1/broadcast` | Broadcast radio packet with ToA & duty tracking | Bearer Auth Required, Rate Limited |
| `POST` | `/api/v1/command` | Universal command handler (`scan`, `broadcast`, etc.) | Bearer Auth Required, Rate Limited |
| `GET` | `/api/v1/map/ascii` | Monospace ASCII map grid | Bearer Auth Required |

---

## 5. One-Line Installation

To deploy the daemon on a fresh Raspberry Pi OS (Lite 64-bit):

```bash
curl -sSL https://raw.githubusercontent.com/hoimu/pi-bridge/main/install.sh | sudo bash
```

Or execute directly from the repository:
```bash
sudo bash src/pi-bridge/install.sh
```
