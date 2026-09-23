"""
BlueZ GATT Peripheral Server for BLE Connection to Phones
"""

import logging

logger = logging.getLogger("hoimu.ble")

class BLEBridge:
    def __init__(self, service_uuid="6e400001-b5a3-f393-e0a9-e50e24dcca9e"):
        self.service_uuid = service_uuid
        self.is_advertising = False
        self.connected_devices = set()

    def start_advertising(self):
        logger.info(f"Starting BLE GATT advertisement for Service UUID: {self.service_uuid}")
        self.is_advertising = True

    def stop_advertising(self):
        self.is_advertising = False

    def send_notification_to_phones(self, packet_bytes: bytes):
        logger.info(f"[BLE-TX] Notifying {len(self.connected_devices)} connected phone(s) with {len(packet_bytes)} bytes")
