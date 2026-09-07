# 🌿 HÕIMU – Zero-Cloud Bioregional Mutual Aid Mesh Network

> **HÕIMU** (Estonian for *"Tribe" / "Kinship"*) is a zero-cloud, privacy-first, offline mutual aid field terminal built for resilient local communities, permaculture hubs, and eco-villages.

---

## 🌟 Key Features

- **📡 Zero-Cloud Offline Mesh Network:** Real-time BLE 5.0+ and Wi-Fi Direct peer discovery with signal strength (RSSI) visualization and Store & Forward packet relaying.
- **🔄 Resource Exchange (Aida / Börs):** Share, gift, and borrow solar power arrays, heritage seeds, bio-remedies, tools, and shelter without money or central infrastructure.
- **🗳️ Solarpunk DAO Governance:** Pseudonymous Ed25519 WebCrypto identity, cryptographic signed votes, vote delegation, and a communal equipment/seed treasury reserve (*Ühisfond*).
- **🎓 Skill Exchange (Oskuste Vahetus):** Offer or request local mentorship in solar wiring, food forestry, radio communications, and micro-hydro system maintenance.
- **🛡️ Chain of Trust (Usaldusväärsuse Ahel):** Signed transaction endorsements with cryptographic verification hashes (`SHA256`) and Symbiosis Score rewards.
- **🚨 Crisis Mode (Kriisirežiim):** Single-tap SOS emergency beacon broadcasting over 433MHz / BLE radio channels.
- **☀️ Solar-Aware Battery Saver:** Adaptive scan intervals based on ambient solar charging current and battery state.
- **🖥️ Self-Hosting & Sync Server:** Pair with a local Raspberry Pi or home server via QR code to sync CRDT ledgers without external cloud dependencies.
- **🌍 Multilingual:** Bilingual UI supporting Estonian (`ET`) and English (`EN`).

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework:** React 18+ with TypeScript & Vite
- **Styling:** Tailwind CSS with Solarpunk Field Terminal Theme Tokens
- **Icons:** Lucide React
- **Cryptography & Security:** WebCrypto API (`Ed25519`, `ECDSA P-256`, `PBKDF2`, `AES-256-GCM`, `WebAuthn`)
- **Persistence:** LocalStorage with JSON CRDT conflict resolution and optional AES-GCM encryption
- **Backend (Optional Self-Hosting):** Node.js / Express with file-backed SQLite storage

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
# 1. Clone repository
git clone https://github.com/hoimu/hoimu-mesh.git
cd hoimu-mesh

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open your browser at `http://localhost:3000` to interact with the field terminal.

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE](./LICENSE) file for details.
