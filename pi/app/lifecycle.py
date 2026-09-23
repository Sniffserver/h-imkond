"""
Daemon Lifecycle Management & Signal Handling
"""

import signal
import sys
import asyncio
import logging

logger = logging.getLogger("hoimu.lifecycle")

class LifecycleManager:
    def __init__(self):
        self.is_running = True
        self._shutdown_callbacks = []

    def register_shutdown_callback(self, callback):
        self._shutdown_callbacks.append(callback)

    def setup_signal_handlers(self, loop=None):
        def _handle_signal(sig, frame):
            sig_name = signal.Signals(sig).name
            logger.info(f"Received termination signal {sig_name}. Initiating graceful shutdown...")
            self.shutdown()

        try:
            signal.signal(signal.SIGINT, _handle_signal)
            signal.signal(signal.SIGTERM, _handle_signal)
        except (ValueError, AttributeError):
            pass # Non-main thread or Windows environment

    def shutdown(self):
        if not self.is_running:
            return
        self.is_running = False
        for cb in self._shutdown_callbacks:
            try:
                cb()
            except Exception as e:
                logger.error(f"Error executing shutdown callback: {e}")
        logger.info("Daemon lifecycle shutdown completed cleanly.")
