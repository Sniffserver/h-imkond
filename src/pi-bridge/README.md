# HÕIMU Raspberry Pi Zero 2 W Hardware Gateway Specification

The **HÕIMU Pi Bridge** is a low-power, solar-assisted headless mesh radio relay daemon running on Raspberry Pi Zero 2 W hardware. It bridges smartphones (via WiFi Direct or USB OTG Ethernet) to SX1262 868MHz LoRa long-range radio hardware and BLE long-range Coded PHY nodes.

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

## 2. API Endpoints & Dynamic Pairing

| Method | Endpoint | Description | Auth & Security |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` / `/api/v1/health` | Public health check | Unauthenticated |
| `POST` | `/api/v1/pair/start` | Start 2-step PIN pairing | Rate limited (5/min), Public |
| `POST` | `/api/v1/pair/confirm` | Confirm 6-digit PIN & mint token | Rate limited (5/min), Public |
| `POST` | `/api/v1/devices/revoke` | Revoke device pairing credential | Bearer Auth Required |
| `GET` | `/api/v1/status` / `/telemetry` | System, battery, solar state | Bearer Auth Required |
| `GET` | `/api/v1/peers` / `/mesh/peers` | List heard BLE / LoRa nodes | Bearer Auth Required |
| `POST` | `/api/v1/broadcast` | Broadcast JSON packet | Bearer Auth Required, Rate Limited |
| `POST` | `/api/v1/command` | Universal command handler | Bearer Auth Required, Rate Limited |
| `GET` | `/api/v1/map/ascii` | Monospace ASCII map grid | Bearer Auth Required |

> **Security Note**: Never embed static secrets in client environment variables prefixed `VITE_` (e.g. `VITE_PI_BRIDGE_TOKEN`). Instead, supply `VITE_PI_BRIDGE_CLIENT_ID="HOIMU-CLIENT-APP"` and obtain dynamic scoped device tokens via `/api/v1/pair`.

---

## 3. WiFi Direct & Access Point Setup

On boot, `hoimu.service` ensures the Pi runs as a WiFi Direct Group Owner (`_hoimu-bridge`) or falls back to an Access Point on `192.168.4.1`.

### `/etc/wpa_supplicant/wpa_supplicant_p2p.conf`
```ini
ctrl_interface=/var/run/wpa_supplicant
update_config=1
device_name=HOIMU-PI-BRIDGE
device_type=1-0050F204-1
p2p_go_intent=15
p2p_go_persistent=1

network={
    ssid="HOIMU-MESH-GATEWAY"
    psk="hoimu-mesh-2026"
    mode=2
    frequency=2412
}
```

---

## 4. One-Line Installation

To deploy the daemon on a fresh Raspberry Pi OS (Lite 64-bit):

```bash
curl -sSL https://raw.githubusercontent.com/hoimu/pi-bridge/main/install.sh | sudo bash
```

Or execute directly from the repository:
```bash
sudo bash src/pi-bridge/install.sh
```

---

## 5. Systemd Service

The daemon is managed as a system service `/etc/systemd/system/hoimu.service`:

```bash
sudo systemctl status hoimu.service
sudo journalctl -u hoimu.service -f
```

---

## 6. ASCII Map Algorithm Compatibility

The Pi daemon generates text-based ASCII maps using the same viewport projection algorithm as `src/components/AsciiMap.tsx`:
- **Center**: `@` represents the user's reference node.
- **Peers**: `O` / `☉` represents surrounding active mesh nodes.
- **Terrain**: `~` (Water / Emajõgi), `♣` (Forest), `□` (Structures), `·` (Explored).
