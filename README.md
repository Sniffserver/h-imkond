# 🌿 HÕIMU – Zero-Cloud Bioregional Mutual Aid Mesh Network

[![CI Workflow](https://github.com/hoimu/hoimu-terminal/actions/workflows/ci.yml/badge.svg)](https://github.com/hoimu/hoimu-terminal/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/badge/release-v0.2.0--alpha.1-emerald)](./docs/release-notes-v0.2.0-alpha.1.md)

> **HÕIMU** (Estonian for *"Tribe" / "Kinship"*) is a zero-cloud, privacy-first, offline mutual aid field terminal built for resilient local communities, permaculture hubs, and eco-villages.

---

## 📰 Latest Release: v0.2.0-alpha.1

For complete release details, architecture overview, security model, and Android verification instructions, see [Release Notes v0.2.0-alpha.1](./docs/release-notes-v0.2.0-alpha.1.md).

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

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.x` or higher (or **Bun** `v1.0+`)
- **Package Manager**: `npm`, `bun`, or `yarn`

### Installation & Local Development

Using `bun`:
```bash
# 1. Install dependencies
bun install

# 2. Start local development server (Port 3000)
bun run dev

# 3. Production build
bun run build

# 4. Typecheck & Verification
bun run verify
```

Or using standard `npm`:
```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build & Verify
npm run verify
```

Open your browser at `http://localhost:3000` to interact with the HÕIMU field terminal.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env.local` or configure runtime environment variables:

```bash
cp .env.example .env.local
```

### Supported Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(Configured in UI)* | Server-side Gemini AI API key for intelligence features. |
| `APP_URL` | *(Injected by platform)* | Self-referential origin URL for links and webhooks. |
| `VITE_PI_BRIDGE_URL` | `http://192.168.4.1:8080` | URL for the Raspberry Pi Zero 2 W hardware gateway daemon. |
| `VITE_ENABLE_LORA_BRIDGE` | `true` | Enables SX1262 LoRa 868MHz long-range packet relaying. |
| `VITE_ENABLE_SOLAR_TELEMETRY`| `true` | Enables solar PV voltage and MPPT battery charging telemetry. |
| `VITE_DEFAULT_LANGUAGE` | `et` | Initial interface locale (`et` or `en`). |

---

## 🍓 Raspberry Pi Hardware Bridge (`pi-bridge`)

The **HÕIMU Pi Bridge** runs as a low-power, solar-assisted headless mesh radio gateway daemon on a Raspberry Pi Zero 2 W with an SX1262 868MHz SPI LoRa HAT and Waveshare e-Paper display.

Detailed hardware wiring diagrams, pinouts, and architecture are documented in [src/pi-bridge/README.md](./src/pi-bridge/README.md).

### Quick Install on Raspberry Pi OS:

```bash
# On your Raspberry Pi Zero 2 W (Lite 64-bit):
curl -sSL https://raw.githubusercontent.com/hoimu/pi-bridge/main/install.sh | sudo bash
```

Or run the local repository script:
```bash
sudo bash src/pi-bridge/install.sh
```

### Service Management
```bash
sudo systemctl status hoimu.service
sudo journalctl -u hoimu.service -f
```

---

## 📱 Android (Capacitor)

HÕIMU is compiled as an offline-first native Android APK via **Capacitor**:

### Android Development Workflow

```bash
# 1. Compile web bundle and sync native Android project
bun run build
npx cap sync android

# 2. Open project in Android Studio
npx cap open android

# 3. Or run directly on connected Android device / emulator
npx cap run android
```

See [docs/capacitor-android-integration.md](./docs/capacitor-android-integration.md) and [docs/android-native-handoff.md](./docs/android-native-handoff.md) for Bluetooth Low Energy (`BLE 5.0+ Coded PHY`) and Wi-Fi Direct native background service details.

### Android Release Flow

To ensure reproducible builds, the Android version is tied directly to Git tags.

### Release Flow

For detailed instructions on version bumping, tagging, and creating web and Android release artifacts, see [docs/release.md](./docs/release.md).

1. **Update Changelog:** Ensure `CHANGELOG.md` reflects the new version (e.g., `v0.1.0`).
2. **Tag the Release:** 
   ```bash
   git tag -a v0.1.0 -m "Initial modular alpha"
   git push origin v0.1.0
   ```
3. **Build Web & Android Artifacts:**
   ```bash
   bun run prepush
   bun run build
   npx cap sync android
   ```
4. **Build APK/AAB:** Build signed production artifacts with Gradle or Android Studio as documented in [docs/release.md](./docs/release.md).

This flow guarantees that any reported issues can be mapped back to the exact source code state.

---

## 🛠️ Development Scripts

Maintenance and verification scripts are centralized in the `scripts/` directory:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `scripts/verify.sh` | `npm run verify` | Full verification pipeline running TypeScript typecheck (`tsc --noEmit`) and production build. |
| `scripts/build-android.sh` | `bash scripts/build-android.sh` | Compiles web assets and synchronizes the native Capacitor Android container. |

### Pre-push Git Hook

Run `bun run prepush` before pushing your changes. This script runs lint, typecheck, tests, and a production build locally to ensure everything works before CI runs it.

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE](./LICENSE) file for details.
