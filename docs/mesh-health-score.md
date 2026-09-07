# 📊 Mesh Health Score Specification

The **Mesh Health Score** is a real-time aggregated telemetry metric that quantifies the operational health, link budget, latency, and store-and-forward relay capacity of the local HÕIMU mesh network.

---

## 🧮 1. Mathematical Formula

The overall Mesh Health Score ($S_{\text{overall}} \in [0, 100]$) is computed as a weighted composite of three sub-metrics:

$$S_{\text{overall}} = 0.35 \cdot S_{\text{RSSI}} + 0.35 \cdot S_{\text{Latency}} + 0.30 \cdot S_{\text{Relay}}$$

---

## 📡 2. Metric Sub-Components

### A. Signal Strength Score ($S_{\text{RSSI}}$)
- **Input**: Average RSSI (Received Signal Strength Indicator) in dBm across all active peers.
- **Mapping**:
  - $ \text{RSSI} \ge -30\text{ dBm} \implies S_{\text{RSSI}} = 100 $
  - $ \text{RSSI} \le -100\text{ dBm} \implies S_{\text{RSSI}} = 0 $
  - Linear scaling between $-100\text{ dBm}$ and $-30\text{ dBm}$.

### B. Peer Latency Score ($S_{\text{Latency}}$)
- **Input**: Average Round-Trip Time (RTT) in milliseconds (ms) between local node and peers.
- **Mapping**:
  - $ \text{RTT} \le 15\text{ ms} \implies S_{\text{Latency}} = 100 $
  - $ \text{RTT} \ge 200\text{ ms} \implies S_{\text{Latency}} = 10 $
  - Linear interpolation for values between 15 ms and 200 ms.

### C. Active Relay Score ($S_{\text{Relay}}$)
- **Input**: Number of active multi-hop relay nodes ($N_{\text{relay}}$) and average relay packet delivery reliability ($R_{\text{relay}} \in [0, 100\%]$).
- **Mapping**:
  - $C_{\text{relay}} = \min(100, 50 + N_{\text{relay}} \cdot 25)$
  - $S_{\text{Relay}} = 0.5 \cdot C_{\text{relay}} + 0.5 \cdot R_{\text{relay}}$

---

## 🟢 3. Health Tiers & Thresholds

| Overall Score | Status Label | Status Badge Styling | Actionable Guidance |
| :--- | :--- | :--- | :--- |
| **90 – 100** | **Optimal Mesh Health** | Teal / Emerald (`bg-[#2A9D8F]`) | Network link budget and relay propagation are optimal. |
| **75 – 89** | **Strong Mesh Health** | Green (`bg-[#87A878]`) | Good connectivity across direct and relayed nodes. |
| **55 – 74** | **Moderate Mesh Health** | Amber / Orange (`bg-[#F4A261]`) | Moderate ping latency or weak edge nodes detected. |
| **0 – 54** | **Degraded Mesh Health** | Red / Terracotta (`bg-[#E76F51]`) | Low signal strength ($<-85\text{ dBm}$) or no active relay nodes. |

---

## 🛠️ 4. Code Implementation

Refer to `src/utils/meshHealthCalculator.ts` and `src/components/MeshStatusCard.tsx` for implementation details.
