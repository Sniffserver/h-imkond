"""
HÕIMU Raspberry Pi Gateway REST API Server
Provides status endpoints and packet TX/RX endpoints for local web applications and diagnostics.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import logging
from pi.protocol.frame import BinaryCodec

logger = logging.getLogger("hoimu.api")

class GatewayRequestHandler(BaseHTTPRequestHandler):
    router = None

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/lora/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            status = {
                "online": True,
                "nodeId": self.router.node_id if self.router else "PI-GW",
                "frequencyMhz": self.router.sx1262.frequency_mhz if self.router else 868.0,
                "hardwareAvailable": self.router.sx1262.is_hardware_available if self.router else False,
                "packetsRelayed": self.router.packets_relayed if self.router else 0
            }
            self.wfile.write(json.dumps(status).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/lora/tx":
            content_length = int(self.headers.get("Content-Length", 0))
            raw_bytes = self.rfile.read(content_length)
            
            success = False
            if self.router:
                success = self.router.handle_ingress_from_phone(raw_bytes)

            self.send_response(200 if success else 400)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_api_server(router, port=5000):
    GatewayRequestHandler.router = router
    server_address = ('', port)
    httpd = HTTPServer(server_address, GatewayRequestHandler)
    logger.info(f"HÕIMU Gateway REST API listening on port {port}")
    httpd.serve_forever()
