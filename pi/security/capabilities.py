"""
HÕIMU Node Capability Tokens & Verification for Raspberry Pi Gateway
"""

import time
from typing import Dict, Any, List

class CapabilityManager:
    CAP_RELAY = "mesh.relay"
    CAP_GATEWAY = "mesh.gateway"
    CAP_EMERGENCY = "mesh.sos"
    CAP_DAO_VOTE = "governance.vote"

    def __init__(self):
        self.node_capabilities: Dict[str, List[str]] = {}

    def grant_capability(self, node_id: str, capability: str):
        if node_id not in self.node_capabilities:
            self.node_capabilities[node_id] = []
        if capability not in self.node_capabilities[node_id]:
            self.node_capabilities[node_id].append(capability)

    def has_capability(self, node_id: str, capability: str) -> bool:
        caps = self.node_capabilities.get(node_id, [])
        return capability in caps or self.CAP_GATEWAY in caps
