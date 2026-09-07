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

## 2. API Endpoints Specification

| Method | Endpoint | Description | Sample Output |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` / `/api/status` | Quick health and voltage check | `{"status": "ok", "battery": 3.92, "solar": 5.24}` |
| `GET` | `/mesh/peers` | List heard BLE / LoRa mesh nodes | `[{"id": "TARTU-LORA-01", "rssi": -68, "protocol": "lora"}]` |
| `POST` | `/mesh/broadcast` | Broadcast JSON packet over hardware | `{"success": true, "txId": "tx-pi-1757152000"}` |
| `GET` | `/map/ascii` | Text/plain monospace viewport grid | `80x40 text grid string` |
| `GET` | `/telemetry` | Full system, CPU, battery, and radio state | `{"piBatteryPercent": 94, "cpuTempC": 42.5, ...}` |
| `POST` | `/gps` | Push phone GPS reference position | `{"success": true, "gps": {"lat": 58.378, "lng": 26.729}}` |
| `POST` | `/config` | Update relay cadence and thresholds | `{"relay_cadence_sec": 15, ...}` |

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
