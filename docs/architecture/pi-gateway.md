# Raspberry Pi Gateway Daemon Architecture

## Subsystems
- `pi/radio/sx1262.py`: Hardware SPI driver for SX1262 LoRa transceiver with CAD (Channel Activity Detection).
- `pi/telemetry/logger.py`: Standardized JSON telemetry formatter.
- `pi/main.py`: Gateway daemon loop connecting local BLE/WebSockets to LoRa RF mesh.
