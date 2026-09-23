"""
HÕIMU Pi Zero 2 W Headless Mesh Daemon & Hardware Gateway (Unified v2.1.0)
Consolidated Single Gateway Service
"""

import os
import sys
import time
import asyncio
import logging

# Ensure pi package is on sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from pi.radio.sx1262 import SX1262Driver
from pi.radio.ble import BleRadio
from pi.routing.router import MeshRouter
from pi.storage.sqlite import SQLiteStorage
from pi.storage.inbox import InboxStore
from pi.storage.outbox import OutboxStore
from pi.security.auth import CapabilityAuth
from pi.security.pairing import PairingManager
from pi.app.lifecycle import LifecycleManager
from pi.app.api import create_api_app, HAS_FASTAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s"
)
logger = logging.getLogger("hoimu.daemon")

class HoimuGatewayDaemon:
    def __init__(
        self,
        node_id: str = "PI-GW-01",
        db_path: str = "hoimu_gateway.db",
        freq_mhz: float = 868.0,
        api_port: int = 8080
    ):
        self.node_id = node_id
        self.api_port = api_port

        # 1. Storage & Persistence
        self.storage = SQLiteStorage(db_path=db_path)
        self.inbox_store = InboxStore(self.storage)
        self.outbox_store = OutboxStore(self.storage)

        # 2. Security Subsystem
        self.auth = CapabilityAuth()
        self.pairing = PairingManager(self.auth)

        # 3. Radio Physical Transceiver (8.1, 8.2, 8.3, 8.4)
        self.sx1262 = SX1262Driver(
            frequency_mhz=freq_mhz,
            duty_cycle_storage=self.storage
        )
        self.ble = BleRadio()

        # 4. Central Mesh Router
        self.router = MeshRouter(
            node_id=self.node_id,
            radio=self.sx1262,
            inbox_store=self.inbox_store,
            outbox_store=self.outbox_store
        )

        # 5. Lifecycle Manager
        self.lifecycle = LifecycleManager()
        self.lifecycle.register_shutdown_callback(self.cleanup)

        # 6. REST API
        self.api_app = create_api_app(
            router=self.router,
            auth_handler=self.auth,
            pairing_manager=self.pairing,
            sx1262_driver=self.sx1262
        )

    def start(self):
        logger.info(f"Starting HÕIMU Gateway Daemon [{self.node_id}]")
        self.lifecycle.setup_signal_handlers()

        # Initialize physical hardware
        self.sx1262.init_hardware()
        self.ble.init_hardware()

        logger.info(f"SX1262 Hardware status: {'READY' if self.sx1262.is_available() else 'SIMULATION'}")

    def cleanup(self):
        logger.info("Cleaning up gateway resources...")
        try:
            self.storage.close()
        except Exception:
            pass

    async def run_rx_loop(self):
        """Continuous physical radio polling and dispatch loop."""
        logger.info("Starting Radio RX poll loop...")
        while self.lifecycle.is_running:
            try:
                # 8.2 RX path check
                self.router.poll_radio()
            except Exception as e:
                logger.error(f"Error in RX loop: {e}")
            await asyncio.sleep(0.01)

    async def run_async(self):
        self.start()
        rx_task = asyncio.create_task(self.run_rx_loop())

        if HAS_FASTAPI and self.api_app:
            import uvicorn
            config = uvicorn.Config(app=self.api_app, host="0.0.0.0", port=self.api_port, log_level="warning")
            server = uvicorn.Server(config)
            await server.serve()
        else:
            logger.info("FastAPI not installed; running pure radio gateway event loop.")
            while self.lifecycle.is_running:
                await asyncio.sleep(1)

        await rx_task

def main():
    daemon = HoimuGatewayDaemon()
    try:
        asyncio.run(daemon.run_async())
    except (KeyboardInterrupt, SystemExit):
        daemon.cleanup()

if __name__ == "__main__":
    main()
