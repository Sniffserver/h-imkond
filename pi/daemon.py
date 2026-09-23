#!/usr/bin/env python3
"""
HÕIMU Gateway Daemon for Raspberry Pi Zero 2 W
Coordinates SX1262 LoRa, BLE GATT Server, and REST API.
"""

import sys
import logging
import threading
from pi.radio.sx1262 import SX1262Driver
from pi.radio.ble import BLEBridge
from pi.storage.sqlite_store import SQLiteMeshStore
from pi.router.lora_router import LoRaGatewayRouter
from pi.api.server import run_api_server

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("hoimu.daemon")

def main():
    logger.info("Starting HÕIMU Pi Gateway Daemon v1.0.0...")
    
    # 1. Initialize Radio & BLE
    sx1262 = SX1262Driver()
    sx1262.init_hardware()

    ble = BLEBridge()
    ble.start_advertising()

    # 2. Initialize Store & Router
    store = SQLiteMeshStore()
    router = LoRaGatewayRouter(node_id="PI-ZERO-GW-01", sx1262=sx1262, ble=ble, store=store)

    # 3. Start REST API thread
    api_thread = threading.Thread(target=run_api_server, args=(router, 5000), daemon=True)
    api_thread.start()

    logger.info("HÕIMU Gateway Daemon running. Press Ctrl+C to terminate.")
    try:
        api_thread.join()
    except KeyboardInterrupt:
        logger.info("Shutting down daemon...")
        ble.stop_advertising()

if __name__ == "__main__":
    main()
