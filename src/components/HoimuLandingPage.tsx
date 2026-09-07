import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  Zap,
  Sun,
  Battery,
  ShieldCheck,
  Download,
  Server,
  Terminal,
  Cpu,
  Wifi,
  Lock,
  Globe,
  BookOpen,
  Sparkles,
  ArrowRight,
  Share2,
  HeartHandshake,
  Leaf,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  Sliders,
  Signal,
  MessageSquare,
  Calendar,
  Users,
  Compass,
  Check,
  Copy,
  Moon,
  ExternalLink,
  HelpCircle,
  Clock,
  HardDrive,
  Book,
  Search,
  ChevronRight,
  FileText,
  MapPin,
  Laptop,
  CheckCircle2,
  Info
} from 'lucide-react';
import { MeshNode, BatteryManagerStatus } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HoimuLandingPageProps {
  onEnterApp: () => void;
  onNavigateToTab?: (tab: 'mesh' | 'map' | 'pathfinder' | 'exchange' | 'journal' | 'profile') => void;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  peersCount?: number;
  batteryStatus?: BatteryManagerStatus;
}

interface WikiArticle {
  id: string;
  category: 'mesh' | 'solar' | 'permaculture' | 'emergency';
  title: string;
  summary: string;
  readTime: string;
  content: string[];
}

export const HoimuLandingPage: React.FC<HoimuLandingPageProps> = ({
  onEnterApp,
  onNavigateToTab,
  isNightMode = false,
  onToggleNightMode,
  peersCount = 8,
  batteryStatus = {
    batteryLevelPercent: 88,
    isCharging: true,
    solarHarvestRateW: 14.8,
    solarAwareModeEnabled: true,
    currentWeatherCondition: 'sunny',
    estimatedHoursRemaining: 34,
  },
}) => {
  // PWA Install hook
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Landing Page Sub-View State
  const [activeSubView, setActiveSubView] = useState<'home' | 'wiki' | 'downloads'>('home');

  // Simulator State
  const [solarIntensityW, setSolarIntensityW] = useState<number>(18.5);
  const [selectedRadio, setSelectedRadio] = useState<'BLE' | 'WiFi' | 'LoRa'>('BLE');
  const [simHops, setSimHops] = useState<number>(2);
  const [isSimulatingPacket, setIsSimulatingPacket] = useState<boolean>(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([
    'SYSTEM: Bioregion Cascadia-44N mesh gateway initialized.',
    'RADIO: 2.4GHz BLE advertising channel 37 active (Zero-Cloud).',
    'STATUS: 8 local peers within RF propagation radius.',
  ]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Wiki State
  const [wikiSearch, setWikiSearch] = useState<string>('');
  const [wikiCategory, setWikiCategory] = useState<'all' | 'mesh' | 'solar' | 'permaculture' | 'emergency'>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Download simulation state
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const [downloadStatus, setDownloadStatus] = useState<{ [key: string]: 'idle' | 'downloading' | 'completed' }>({});

  const triggerMapDownload = (regionId: string) => {
    if (downloadStatus[regionId] === 'downloading' || downloadStatus[regionId] === 'completed') return;
    
    setDownloadStatus(prev => ({ ...prev, [regionId]: 'downloading' }));
    setDownloadProgress(prev => ({ ...prev, [regionId]: 0 }));

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        const current = prev[regionId] || 0;
        if (current >= 100) {
          clearInterval(interval);
          setDownloadStatus(statusPrev => ({ ...statusPrev, [regionId]: 'completed' }));
          return { ...prev, [regionId]: 100 };
        }
        // Varied increments for high-fidelity feel
        const inc = Math.floor(Math.random() * 15) + 5;
        return { ...prev, [regionId]: Math.min(100, current + inc) };
      });
    }, 250);
  };

  // Run a packet simulation
  const handleSimulatePacket = () => {
    if (isSimulatingPacket) return;
    setIsSimulatingPacket(true);

    const packetId = `pk-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const timestamp = new Date().toLocaleTimeString();

    setSimulationLog((prev) => [
      `[${timestamp}] 🚀 Originating DTN Packet [${packetId}] (Payload: Heritage Rye Seeds)`,
      ...prev.slice(0, 9),
    ]);

    setTimeout(() => {
      setSimulationLog((prev) => [
        `[${new Date().toLocaleTimeString()}] 📡 Hop 1/2: Relayed via peer "Moss-Whisper" (RSSI: -54 dBm, Link: 94%)`,
        ...prev.slice(0, 9),
      ]);
    }, 600);

    setTimeout(() => {
      setSimulationLog((prev) => [
        `[${new Date().toLocaleTimeString()}] 🔄 Hop 2/2: Delivered to destination node "Alder-Crest" via ${selectedRadio} (${simHops} hops total)`,
        `[${new Date().toLocaleTimeString()}] 🔒 Ed25519 Signature Verified: SHA256: 4e9a...b82d. Merged into local CRDT ledger with ZERO cloud dependency.`,
        ...prev.slice(0, 9),
      ]);
      setIsSimulatingPacket(false);
    }, 1300);
  };

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const selfHostSnippet = `# 1. Clone & run HÕIMU Local Solar Relay Node (Raspberry Pi / Linux)
git clone https://github.com/hoimu-mesh/hoimu-relay-node.git
cd hoimu-relay-node

# 2. Run with Docker or native Node.js
docker compose up -d

# 3. Status: 100% offline local BLE & Wi-Fi sync server running on http://0.0.0.0:3000
# Zero telecom cables. Zero telemetry. All ledger data encrypted on local flash.`;

  const dockerComposeSnippet = `version: '3.8'
services:
  hoimu-relay:
    image: hoimu/solar-relay-node:latest
    container_name: hoimu_relay_node
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CRDT_SYNC_INTERVAL_SEC=30
      - SQLITE_DB_PATH=/data/hoimu_mesh.db
    volumes:
      - hoimu-data:/data

volumes:
  hoimu-data:`;

  const faqs = [
    {
      q: 'How does HÕIMU communicate when the internet and cell towers are completely down?',
      a: 'HÕIMU creates an ad-hoc local mesh using short-range 2.4GHz Bluetooth Low Energy (BLE) and Wi-Fi Direct beacons natively supported by modern smartphones and laptops. When peers move between neighborhoods, farmsteads, or emergency shelters, messages and transactions are carried via Delay-Tolerant Networking (DTN) store-and-forward routing — literally passing packets physically from node to node like physical letters.',
    },
    {
      q: 'Is my personal data or location tracked on any central server?',
      a: 'Absolutely not. HÕIMU is strictly Zero-Cloud. There are no remote databases, analytics trackers, corporate servers, or user accounts. All information lives solely on your device’s local encrypted storage (IndexedDB). Identities are cryptographic keypairs (Ed25519) that you control and can export or wipe at any second.',
    },
    {
      q: 'What is the "Symbiosis Score" and can it be bought with fiat currency?',
      a: 'The Symbiosis Score is a non-monetary mutual-aid index. It cannot be bought, sold, or transferred. You earn it purely through verifiable contributions to your bioregion: sharing tools, harvesting food, donating surplus solar energy, teaching skills, or resolving crisis alerts. It determines your democratic weighting in Bioregional DAO civic proposals.',
    },
    {
      q: 'How does the Solar-Aware adaptive computing system work?',
      a: 'When running on battery or off-grid solar kits, HÕIMU monitors your device battery and harvesting rate. If battery drops below 20% or light is low, it automatically enters Low-Power Field Mode: throttling background radio scans from every 2 seconds to every 30 seconds, pausing non-urgent syncs, and preserving battery life so your terminal remains operable for days.',
    },
    {
      q: 'Can HÕIMU bridge to long-range LoRa or Meshtastic hardware?',
      a: 'Yes! HÕIMU includes standard packet export interfaces and local WebSocket/HTTP APIs compatible with ESP32 LoRa nodes, Heltec v3 modules, and Raspberry Pi field gateways. You can bridge your local phone mesh over kilometers of wilderness terrain using 868MHz / 915MHz packet radio.',
    },
    {
      q: 'How do I install HÕIMU on my phone or tablet?',
      a: 'HÕIMU is built as a Progressive Web App (PWA). Simply tap "Install Field Terminal" or "Add to Home Screen" in your browser. Once installed, it opens instantly without an internet connection, caches all assets offline, and runs as a full native-feeling application.',
    },
  ];

  // Solarpunk Wiki Articles
  const wikiArticles: WikiArticle[] = [
    {
      id: 'dtn-ble',
      category: 'mesh',
      title: 'Delay-Tolerant Networking (DTN) Over Bluetooth BLE',
      summary: 'Learn how physical movement bridges wireless gaps using the store-and-forward DTN protocol.',
      readTime: '4 min read',
      content: [
        'Delay-Tolerant Networking (DTN) is the backbone of HÕIMU’s off-grid routing engine. Unlike traditional internet protocols that require an active end-to-end path, DTN operates on a "store-and-forward" model.',
        'When you send a message, create a transaction, or publish a bioregional proposal, your phone encapsulates this data in an encrypted packet signed with your Ed25519 cryptographic key. It assigns a Time-To-Live (TTL, typically 3 hops or 7 days).',
        'Your phone then advertises this packet over 2.4GHz BLE and Wi-Fi Direct. Any neighboring HÕIMU terminal within range (up to 30-50m) grabs the packet and stores it securely in its local IndexedDB. Even if that neighbor has no path to the target, they act as a physical courier. As they walk to another neighborhood, commute to the city, or hike over a ridge, their device continuously checks for new peers.',
        'When they come within range of another node, the packets replicate seamlessly using optimized Conflict-Free Replicated Data Types (CRDTs). Eventually, the packet physically glides to its destination, replicating over wide gaps with zero telecom towers.'
      ]
    },
    {
      id: 'lifepo4-solar',
      category: 'solar',
      title: 'Sizing an Off-Grid Solar Power Micro-Server',
      summary: 'Practical math for building a 24/7 perpetual solar mesh relay node with lithium batteries.',
      readTime: '6 min read',
      content: [
        'Deploying a permanent community relay node requires careful energy calculations. A typical Raspberry Pi Zero 2W configured as a HÕIMU local relay node consumes around 0.7 Watts of power (around 17 Watt-hours per day).',
        'To ensure 24/7 uptime even through heavy winter storms or cloudy periods, we design for a minimum of 3 days of autonomy (reserve capacity). This means we need at least 50 Watt-hours of battery storage. We highly recommend LiFePO4 (Lithium Iron Phosphate) cells because they survive over 3,000–5,000 cycles and run safely in extreme temperatures (-20°C to +60°C).',
        'A 12V 6Ah LiFePO4 pack yields 72 Watt-hours, giving comfortable headroom. To charge this pack during brief winter daylight windows, use a weatherized 20W to 30W monocrystalline solar panel coupled with a high-efficiency MPPT (Maximum Power Point Tracking) charge controller.',
        'HÕIMU’s Solar-Aware engine syncs directly with the node’s energy statistics. Under heavy cloud cover or low battery, the system gracefully lowers radio transmission frequency and suspends secondary data caching, ensuring the basic emergency communications beacon never dies.'
      ]
    },
    {
      id: 'seed-saving',
      category: 'permaculture',
      title: 'Heritage Seed Saving & Bio-Regional Seed Vaults',
      summary: 'How to build and maintain a local seed commons with moisture-proof packaging.',
      readTime: '5 min read',
      content: [
        'Resilient food systems start with open-pollinated, non-hybrid heritage seeds. These varieties are genetically diverse and adapt organically to local soil, pests, and microclimates over multiple generations.',
        'When establishing a community Seed Commons on HÕIMU, proper seed processing and physical storage are paramount. Harvest seeds only from mature, healthy crops on dry days. Ensure wet seeds (like tomatoes or squash) are fully fermented, rinsed, and dehydrated on paper screens until they crack under pressure rather than bending.',
        'Moisture is the ultimate enemy of seed longevity. For every 1% decrease in seed moisture, seed storage life doubles. Store dried seeds in airtight glass mason jars with food-grade silica gel packets to absorb residual humidity.',
        'Place the jars in a cold, dark place (ideally below 10°C). Log your inventory on the HÕIMU Resource Commons with germination dates and variety details. Neighboring stewards can then locate available varieties on their mesh map and initiate contactless seed exchanges.'
      ]
    },
    {
      id: 'antenna-tuning',
      category: 'mesh',
      title: 'Tuning High-Gain Antenna Arrays for LoRa & Ham Bands',
      summary: 'A field guide to VSWR, NanoVNA analyzers, and establishing 10km line-of-sight relays.',
      readTime: '7 min read',
      content: [
        'While BLE and Wi-Fi Direct provide high bandwidth for short ranges, long-range communication requires packet radio interfaces such as LoRa (868MHz in Europe, 915MHz in North America) or amateur ham radio bands.',
        'The performance of a LoRa transmitter depends entirely on its antenna. An untuned antenna wastes up to 90% of its transmission power as heat reflected back into the radio chip, which can damage the hardware. We measure this efficiency using VSWR (Voltage Standing Wave Ratio). An ideal antenna has a VSWR of 1.1:1, while anything above 2.0:1 is highly inefficient.',
        'To tune a custom-built 3-element Yagi or omnidirectional collinear antenna, connect it to a portable NanoVNA (Vector Network Analyzer). Calibrate the analyzer and sweep the target frequency range (e.g., 863-870 MHz). Adjust the physical length of the antenna elements or the matching coil until the VSWR dips as close to 1.0 as possible.',
        'Place high-gain directional Yagi antennas on ridges, trees, or rooftops. Under clear line-of-sight conditions, a tuned 100mW LoRa module can easily bridge 10 to 15 kilometers, creating long-distance corridors between distinct valley networks.'
      ]
    },
    {
      id: 'emergency-beacons',
      category: 'emergency',
      title: 'Standard Wilderness & Crisis Radio Protocols',
      summary: 'Emergency frequencies, phonetic alphabets, and operating community crisis beacons.',
      readTime: '5 min read',
      content: [
        'During natural disasters, heavy winter freezes, or grid failures, structured communication protocols prevent chaos. HÕIMU features an emergency Crisis Mode designed to interface with standard analog radio operations.',
        'If you must transmit voice or text warnings, memorize the standard distress protocols. On analogue VHF/UHF radios, monitor FRS Channel 1 (with CTCSS tone 88.5) and GMRS Channel 20. For long-distance HF emergency nets, tune to the regional Wilderness Protocol frequencies (e.g., 146.52 MHz VHF at the top of every hour for 5 minutes).',
        'When broadcasting an emergency alert via HÕIMU, keep the message strictly factual: State your exact location (grid reference or landmarks), the nature of the emergency (medical, fire, power failure), and immediate resource needs (water, tourniquets, battery backup).',
        'All neighboring terminals receiving an SOS alert automatically lock into a high-intensity relay cycle, bypassing regular mesh depth limitations to flood the warning across all linked BLE, Wi-Fi Direct, and LoRa radios in range.'
      ]
    }
  ];

  // Filters for Wiki articles
  const filteredWikiArticles = wikiArticles.filter(art => {
    const matchesCat = wikiCategory === 'all' || art.category === wikiCategory;
    const matchesSearch = art.title.toLowerCase().includes(wikiSearch.toLowerCase()) || 
                          art.summary.toLowerCase().includes(wikiSearch.toLowerCase()) ||
                          art.content.join(' ').toLowerCase().includes(wikiSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      className={`min-h-screen font-sans selection:bg-[#87A878]/30 transition-colors duration-300 ${
        isNightMode ? 'bg-[#141C12] text-[#F0F5EE]' : 'bg-[#FAF6EE] text-[#203A2A]'
      }`}
    >
      {/* =========================================================================
          TOP PERSISTENT TELEMETRY & NAVIGATION
      ========================================================================= */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors duration-200 ${
          isNightMode ? 'bg-[#182315]/95 border-[#2A3B26]' : 'bg-[#FAF6EE]/90 border-[#87A878]/30'
        }`}
      >
        {/* Solarpunk Field Telemetry Strip */}
        <div
          className={`px-4 py-1.5 text-[11px] font-mono flex items-center justify-between border-b ${
            isNightMode ? 'bg-[#10170E] text-[#A8BDA5] border-[#2A3B26]' : 'bg-[#203A2A] text-[#F0F5EE] border-[#87A878]/20'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#87A878] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#87A878]" />
            </span>
            <span className="text-[#E9C46A] font-bold">BIOREGION MESH ACTIVE</span>
            <span className="text-white/40 hidden sm:inline">•</span>
            <span className="hidden sm:inline text-[#A8BDA5]">
              {peersCount} Nodes in RF Range · Zero-Cloud P2P
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[#E9C46A]">
              <Zap className="w-3 h-3" />
              <span>{batteryStatus.solarHarvestRateW}W Harvest</span>
            </span>
            <span className="flex items-center gap-1 text-[#F0F5EE]">
              <Battery className="w-3.5 h-3.5 text-[#87A878]" />
              <span>{batteryStatus.batteryLevelPercent}%</span>
            </span>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveSubView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#588157] via-[#87A878] to-[#E9C46A] p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div
                className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                  isNightMode ? 'bg-[#182315]' : 'bg-[#FAF6EE]'
                }`}
              >
                <span className={`font-display font-black text-xl ${isNightMode ? 'text-[#E9C46A]' : 'text-[#203A2A]'}`}>
                  Hõ
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-xl tracking-tight">HÕIMU</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#87A878]/20 text-[#588157] dark:text-[#87A878] border border-[#87A878]/30">
                  Solarpunk Mesh
                </span>
              </div>
              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] hidden sm:block">
                Offline Mutual-Aid Field Terminal
              </p>
            </div>
          </div>

          {/* Sub-View Navigation Controls */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#588157]/10 border border-[#87A878]/20 text-xs font-bold">
            <button
              onClick={() => { setActiveSubView('home'); setSelectedArticleId(null); }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeSubView === 'home'
                  ? 'bg-[#203A2A] text-white shadow-sm'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#588157]'
              }`}
            >
              Terminal Base
            </button>
            <button
              onClick={() => { setActiveSubView('wiki'); setSelectedArticleId(null); }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeSubView === 'wiki'
                  ? 'bg-[#203A2A] text-white shadow-sm'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#588157]'
              }`}
            >
              Field Wiki
            </button>
            <button
              onClick={() => { setActiveSubView('downloads'); setSelectedArticleId(null); }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeSubView === 'downloads'
                  ? 'bg-[#203A2A] text-white shadow-sm'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:text-[#588157]'
              }`}
            >
              Downloads & Setup
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            {onToggleNightMode && (
              <button
                type="button"
                onClick={onToggleNightMode}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isNightMode
                    ? 'bg-[#1F2E1C] border-[#364E30] text-[#E9C46A] hover:bg-[#2A3B26]'
                    : 'bg-white border-[#87A878]/30 text-[#203A2A] hover:bg-[#FAF6EE]'
                }`}
                title="Toggle Solarpunk Night Theme"
              >
                {isNightMode ? <Sun className="w-4 h-4 text-[#E9C46A]" /> : <Moon className="w-4 h-4 text-[#588157]" />}
              </button>
            )}

            <button
              id="landing-enter-terminal-btn"
              type="button"
              onClick={onEnterApp}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl font-display font-bold text-sm bg-gradient-to-r from-[#588157] to-[#2A9D8F] text-white shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer group"
            >
              <span>Launch Terminal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SUB-VIEW 1: HOME LANDING PAGE
      ========================================================================= */}
      <AnimatePresence mode="wait">
        {activeSubView === 'home' && (
          <motion.div
            key="home-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* HERO SECTION */}
            <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden border-b border-current/10">
              <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(#588157_1px,transparent_1px)] [background-size:24px_24px]" />

              <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto space-y-6">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#588157]/15 text-[#588157] dark:text-[#E9C46A] border border-[#87A878]/30">
                    <Leaf className="w-3.5 h-3.5 text-[#588157] dark:text-[#E9C46A]" />
                    <span>Offline Mutual-Aid Protocol · Zero-Cloud & Local-First</span>
                  </div>

                  <h1 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl tracking-tight leading-[1.12]">
                    The offline mutual-aid mesh for when the grid goes dark —
                    <span className="block mt-1 text-[#588157] dark:text-[#87A878]">
                      and for building the world after.
                    </span>
                  </h1>

                  <p className="text-base sm:text-lg text-[#637062] dark:text-[#A8BDA5] leading-relaxed max-w-2xl mx-auto">
                    HÕIMU turns ordinary phones and radios into an encrypted, off-grid community terminal.
                    Share tools, heritage seeds, renewable energy, and emergency aid directly over Bluetooth Low Energy,
                    Wi-Fi Direct, and packet radio — with no cell towers, no corporate cloud, and zero surveillance.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
                    <button
                      type="button"
                      onClick={onEnterApp}
                      className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-display font-bold text-sm sm:text-base bg-[#203A2A] dark:bg-[#E9C46A] text-white dark:text-[#182315] shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer"
                    >
                      <Terminal className="w-4 h-4 text-[#87A878] dark:text-[#203A2A]" />
                      <span>Open Live Field Terminal</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <a
                      href="#simulator"
                      className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                        isNightMode
                          ? 'bg-[#182315] hover:bg-[#2A3B26] text-[#E9C46A] border-[#364E30]'
                          : 'bg-white hover:bg-[#FAF6EE] text-[#203A2A] border-[#87A878]/40 shadow-xs'
                      }`}
                    >
                      <Radio className="w-4 h-4 text-[#588157]" />
                      <span>Try Mesh Simulator</span>
                    </a>

                    <button
                      onClick={() => setActiveSubView('downloads')}
                      className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                        isNightMode
                          ? 'bg-[#182315] hover:bg-[#2A3B26] text-[#A8BDA5] border-[#364E30]'
                          : 'bg-white hover:bg-[#FAF6EE] text-[#588157] border-[#87A878]/40 shadow-xs'
                      }`}
                    >
                      <Download className="w-4 h-4 text-[#2A9D8F]" />
                      <span>Offline Setup & Wiki</span>
                    </button>
                  </div>

                  {/* Quick Metrics Bar */}
                  <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
                    {[
                      { label: 'Cloud Servers Required', value: '0', sub: '100% device-to-device' },
                      { label: 'Default Radio Range', value: '30m – 5km', sub: 'BLE, Wi-Fi P2P & LoRa' },
                      { label: 'Cryptography Standard', value: 'Ed25519', sub: 'Self-sovereign signatures' },
                      { label: 'Power Consumption', value: '< 0.3W', sub: 'Solar harvest adaptive' },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border ${
                          isNightMode
                            ? 'bg-[#182315]/80 border-[#2A3B26]'
                            : 'bg-white/80 border-[#87A878]/25 shadow-2xs'
                        }`}
                      >
                        <div className="font-display font-extrabold text-xl sm:text-2xl text-[#588157] dark:text-[#E9C46A]">
                          {item.value}
                        </div>
                        <div className="font-semibold text-xs text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-[#637062] dark:text-[#87A878] font-mono mt-0.5">
                          {item.sub}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* INTERACTIVE LIVE MESH SIMULATOR */}
            <section id="simulator" className="py-16 md:py-20 border-b border-current/10 relative scroll-mt-14">
              <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Hands-On Radio Propagation Sandbox</span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
                    Experience Delay-Tolerant Mesh in Action
                  </h2>
                  <p className="text-sm text-[#637062] dark:text-[#A8BDA5]">
                    Test how HÕIMU relays encrypted packets across physical nodes without telecom towers or internet.
                    Adjust solar harvesting, switch radio bands, and trigger a multi-hop store-and-forward relay.
                  </p>
                </div>

                <div
                  className={`rounded-3xl border p-5 sm:p-8 shadow-xl ${
                    isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/40'
                  }`}
                >
                  <div className="grid lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 space-y-5">
                      {/* Solar Input Slider */}
                      <div
                        className={`p-4 rounded-2xl border ${
                          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-2">
                          <span className="flex items-center gap-1.5 text-[#588157] dark:text-[#E9C46A]">
                            <Sun className="w-4 h-4" />
                            <span>Solar Influx & Harvest: {solarIntensityW.toFixed(1)}W</span>
                          </span>
                          <span
                            className={`font-mono text-[11px] px-2 py-0.5 rounded-full ${
                              solarIntensityW > 10
                                ? 'bg-[#87A878]/20 text-[#588157]'
                                : 'bg-[#E76F51]/20 text-[#E76F51]'
                            }`}
                          >
                            {solarIntensityW > 10 ? 'High Harvest Mode' : 'Throttled Low-Power'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={35}
                          step={0.5}
                          value={solarIntensityW}
                          onChange={(e) => setSolarIntensityW(parseFloat(e.target.value))}
                          className="w-full accent-[#588157] cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] mt-1">
                          <span>0W (Night / Storm)</span>
                          <span>18W (Partly Cloudy)</span>
                          <span>35W (Peak Sun)</span>
                        </div>
                      </div>

                      {/* Radio Band Selector */}
                      <div
                        className={`p-4 rounded-2xl border ${
                          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
                        }`}
                      >
                        <label className="text-xs font-bold block mb-2 text-[#203A2A] dark:text-[#F0F5EE]">
                          Physical Mesh Protocol
                        </label>
                        <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                          {[
                            { id: 'BLE', label: 'BLE 2.4GHz', range: '30-50m' },
                            { id: 'WiFi', label: 'Wi-Fi Direct', range: '100-150m' },
                            { id: 'LoRa', label: 'LoRa 868MHz', range: '2-5km' },
                          ].map((proto) => (
                            <button
                              key={proto.id}
                              type="button"
                              onClick={() => setSelectedRadio(proto.id as any)}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                selectedRadio === proto.id
                                  ? 'bg-[#203A2A] dark:bg-[#E9C46A] text-white dark:text-[#182315] border-transparent shadow-xs'
                                  : isNightMode
                                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:text-white'
                                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
                              }`}
                            >
                              <div className="font-bold">{proto.label}</div>
                              <div className="text-[10px] opacity-75">{proto.range}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action Button: Broadcast Packet */}
                      <button
                        type="button"
                        onClick={handleSimulatePacket}
                        disabled={isSimulatingPacket}
                        className="w-full py-3.5 px-4 rounded-2xl font-display font-bold text-sm bg-[#588157] hover:bg-[#476a46] text-white shadow-md active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSimulatingPacket ? 'animate-spin' : ''}`} />
                        <span>{isSimulatingPacket ? 'Propagating Across Relays...' : 'Broadcast Multi-Hop Mesh Packet'}</span>
                      </button>
                    </div>

                    <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                      {/* Visual Node Hop Diagram */}
                      <div
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left ${
                          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#588157] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            YOU
                          </div>
                          <div>
                            <div className="text-xs font-bold">Origin Node</div>
                            <div className="text-[11px] font-mono text-[#588157] dark:text-[#87A878]">Local Terminal</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[#87A878] font-mono text-xs">
                          <span className="h-0.5 w-6 bg-[#87A878]" />
                          <span className="px-2 py-0.5 rounded-full bg-[#87A878]/20 text-[10px] font-bold">
                            {selectedRadio}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#2A9D8F] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            RELAY
                          </div>
                          <div>
                            <div className="text-xs font-bold">Moss-Whisper</div>
                            <div className="text-[11px] font-mono text-[#2A9D8F]">-54 dBm</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[#87A878] font-mono text-xs">
                          <span className="h-0.5 w-6 bg-[#87A878]" />
                          <span className="px-2 py-0.5 rounded-full bg-[#87A878]/20 text-[10px] font-bold">DTN</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#E9C46A] text-[#203A2A] flex items-center justify-center font-bold text-xs shadow-xs">
                            DEST
                          </div>
                          <div>
                            <div className="text-xs font-bold">Alder-Crest</div>
                            <div className="text-[11px] font-mono text-[#E9C46A]">Neighbor Node</div>
                          </div>
                        </div>
                      </div>

                      {/* Packet Console Log */}
                      <div
                        className={`p-4 rounded-2xl border font-mono text-xs flex-1 min-h-[160px] flex flex-col justify-between ${
                          isNightMode ? 'bg-[#0E150D] border-[#2A3B26] text-[#A8BDA5]' : 'bg-[#1E2C22] text-[#D4E2D1] border-[#2A3B26]'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[11px]">
                          <span className="text-[#E9C46A] flex items-center gap-1.5 font-bold">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>LIVE PACKET PROPAGATION STREAM</span>
                          </span>
                          <span className="text-[10px] text-white/50">Zero-Cloud Log</span>
                        </div>

                        <div className="space-y-1.5 my-2 overflow-y-auto max-h-[140px] pr-1">
                          {simulationLog.map((line, i) => (
                            <div key={i} className="leading-snug text-[11px]">
                              {line}
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-white/10 text-[10px] text-white/50 flex justify-between">
                          <span>Cryptographic Engine: Ed25519 Native</span>
                          <span>Replication: CRDT Multi-Master</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FOUR ARCHITECTURAL PILLARS OF HÕIMU */}
            <section className="py-16 md:py-20 border-b border-current/10">
              <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#588157]/15 text-[#588157] dark:text-[#E9C46A] border border-[#87A878]/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Architectural Principles</span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
                    Engineered for Bioregional Survival & Thriving
                  </h2>
                  <p className="text-sm text-[#637062] dark:text-[#A8BDA5]">
                    Traditional apps stop functioning the second the cellular grid or cloud servers drop.
                    HÕIMU was built from scratch with inverted assumptions.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      icon: HardDrive,
                      title: 'Zero-Cloud Local-First',
                      desc: 'All ledger data, chats, and proposals live in local IndexedDB. Encrypted multi-master CRDTs reconcile automatically upon proximity.',
                      color: 'text-[#2A9D8F]',
                      bg: 'bg-[#2A9D8F]/10',
                    },
                    {
                      icon: Radio,
                      title: 'Delay-Tolerant Radio Mesh',
                      desc: 'Packets hop across phones, laptops, and solar nodes using BLE, Wi-Fi Direct, and packet radio without internet connections.',
                      color: 'text-[#588157]',
                      bg: 'bg-[#588157]/10',
                    },
                    {
                      icon: HeartHandshake,
                      title: 'The Symbiosis Economy',
                      desc: 'Replace extractive financial speculation with verified mutual aid. Earn non-transferable reputation points by sharing seeds and labor.',
                      color: 'text-[#E9C46A]',
                      bg: 'bg-[#E9C46A]/10',
                    },
                    {
                      icon: Sun,
                      title: 'Solar-Aware Computing',
                      desc: 'Built to survive power limits. Automatically sheds heavy background polling when overcast skies or low battery are detected.',
                      color: 'text-[#E76F51]',
                      bg: 'bg-[#E76F51]/10',
                    },
                  ].map((pillar, idx) => {
                    const Icon = pillar.icon;
                    return (
                      <div
                        key={idx}
                        className={`p-6 rounded-3xl border flex flex-col justify-between space-y-4 transition-all hover:scale-[1.01] ${
                          isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/30 shadow-xs'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl ${pillar.bg} ${pillar.color} flex items-center justify-center shrink-0`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-lg mb-2 text-[#203A2A] dark:text-[#F0F5EE]">
                            {pillar.title}
                          </h3>
                          <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                            {pillar.desc}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-current/10 text-[11px] font-mono font-semibold text-[#588157] dark:text-[#87A878]">
                          0% Cloud · 100% P2P
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* FREQUENTLY ASKED QUESTIONS */}
            <section className="py-16 md:py-20 border-b border-current/10">
              <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#588157]/15 text-[#588157] dark:text-[#E9C46A] border border-[#87A878]/30">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Common Questions</span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
                    Frequently Asked Questions
                  </h2>
                  <p className="text-sm text-[#637062] dark:text-[#A8BDA5]">
                    Everything you need to know about setting up and using HÕIMU off-grid.
                  </p>
                </div>

                <div className="space-y-3">
                  {faqs.map((faq, idx) => {
                    const isOpen = openFaq === idx;
                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? null : idx)}
                          className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                        >
                          <span className="font-display font-bold text-sm sm:text-base text-[#203A2A] dark:text-[#F0F5EE]">
                            {faq.q}
                          </span>
                          <span className="shrink-0 p-1 text-[#588157] dark:text-[#E9C46A]">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] leading-relaxed border-t border-current/10 pt-3">
                                {faq.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* =========================================================================
            SUB-VIEW 2: BIOMIMETIC FIELD WIKI (KNOWLEDGE BASE)
        ========================================================================= */}
        {activeSubView === 'wiki' && (
          <motion.div
            key="wiki-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto px-4 sm:px-6 py-10"
          >
            {/* Header section with Search */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#588157]/15 text-[#588157] dark:text-[#E9C46A] border border-[#87A878]/30">
                  <Book className="w-3.5 h-3.5" />
                  <span>Bioregional Decentralized Knowledge Base</span>
                </div>
                <h2 className="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
                  HÕIMU Off-Grid Field Wiki
                </h2>
                <p className="text-sm text-[#637062] dark:text-[#A8BDA5] max-w-xl">
                  Peer-contributed, local-first technical guides for running robust mesh networks, sizing off-grid solar rigs, storing seed catalogs, and coordinating field rescue.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#637062] dark:text-[#A8BDA5]" />
                <input
                  type="text"
                  placeholder="Search articles and guides..."
                  value={wikiSearch}
                  onChange={(e) => setWikiSearch(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#588157] transition-all ${
                    isNightMode
                      ? 'bg-[#1a2517] border-[#2A3B26] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {[
                { id: 'all', label: 'All Articles', count: wikiArticles.length },
                { id: 'mesh', label: '📡 Mesh & RF Radio', count: wikiArticles.filter(a => a.category === 'mesh').length },
                { id: 'solar', label: '☀️ Solar & Energy', count: wikiArticles.filter(a => a.category === 'solar').length },
                { id: 'permaculture', label: '🌾 Seed & Food Commons', count: wikiArticles.filter(a => a.category === 'permaculture').length },
                { id: 'emergency', label: '🚨 Preparedness & Emergency', count: wikiArticles.filter(a => a.category === 'emergency').length },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setWikiCategory(cat.id as any); setSelectedArticleId(null); }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    wikiCategory === cat.id
                      ? 'bg-[#203A2A] text-white shadow-sm'
                      : isNightMode
                      ? 'bg-[#182315] text-[#A8BDA5] border border-[#2A3B26] hover:text-[#F0F5EE]'
                      : 'bg-white text-[#637062] border border-[#87A878]/30 hover:border-[#87A878]'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-[10px] font-mono opacity-60">({cat.count})</span>
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left sidebar: Articles List */}
              <div className="lg:col-span-5 space-y-3.5">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#588157] dark:text-[#87A878] mb-1">
                  Guides & Documentation ({filteredWikiArticles.length})
                </h3>
                {filteredWikiArticles.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-current/10 text-xs text-[#637062]">
                    No articles found matching filters.
                  </div>
                ) : (
                  filteredWikiArticles.map((art) => {
                    const isSelected = selectedArticleId === art.id || (!selectedArticleId && filteredWikiArticles[0].id === art.id);
                    return (
                      <button
                        key={art.id}
                        onClick={() => setSelectedArticleId(art.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer block ${
                          isSelected
                            ? 'bg-[#588157]/10 border-[#588157] shadow-xs'
                            : isNightMode
                            ? 'bg-[#182315] border-[#2A3B26] hover:border-[#3A5A39]'
                            : 'bg-white border-[#87A878]/30 hover:border-[#87A878]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                            art.category === 'mesh' ? 'bg-[#588157]/15 text-[#588157]' :
                            art.category === 'solar' ? 'bg-[#E9C46A]/20 text-[#203A2A] dark:text-[#E9C46A]' :
                            art.category === 'permaculture' ? 'bg-[#2A9D8F]/15 text-[#2A9D8F]' :
                            'bg-[#E76F51]/15 text-[#E76F51]'
                          }`}>
                            {art.category}
                          </span>
                          <span className="text-[11px] font-mono text-[#637062] dark:text-[#87A878]">{art.readTime}</span>
                        </div>
                        <h4 className="font-display font-extrabold text-sm text-[#203A2A] dark:text-[#F0F5EE] leading-snug">
                          {art.title}
                        </h4>
                        <p className="text-xs text-[#637062] dark:text-[#A8BDA5] line-clamp-2 mt-1 leading-relaxed">
                          {art.summary}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right panel: Active Article Reader */}
              <div className="lg:col-span-7">
                {(() => {
                  const activeArt = wikiArticles.find(a => a.id === (selectedArticleId || (filteredWikiArticles[0]?.id)));
                  if (!activeArt) return null;
                  
                  return (
                    <div className={`p-6 sm:p-8 rounded-3xl border ${
                      isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/40 shadow-sm'
                    }`}>
                      {/* Reader Header */}
                      <div className="border-b border-current/10 pb-4 mb-6">
                        <div className="flex items-center gap-2 mb-2 text-xs font-mono text-[#637062] dark:text-[#A8BDA5]">
                          <span className="font-bold text-[#588157]">{activeArt.category.toUpperCase()} SECTION</span>
                          <span>•</span>
                          <span>{activeArt.readTime}</span>
                          <span>•</span>
                          <span className="text-emerald-500 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified Offline Asset</span>
                          </span>
                        </div>
                        <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#203A2A] dark:text-[#F0F5EE] tracking-tight leading-tight">
                          {activeArt.title}
                        </h1>
                      </div>

                      {/* Reader Body */}
                      <div className="space-y-4 text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                        {activeArt.content.map((paragraph, i) => {
                          // Style code snippets or callouts if they contain technical keywords
                          if (paragraph.includes('VSWR') || paragraph.includes('MPPT') || paragraph.includes('TTL') || paragraph.includes('LiFePO4')) {
                            return (
                              <div key={i} className="p-4 rounded-2xl bg-[#588157]/5 border-l-4 border-[#588157] space-y-1 my-3">
                                <p className="font-semibold text-xs text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1">
                                  <Info className="w-3.5 h-3.5 text-[#588157]" />
                                  <span>Technical Blueprint Specs</span>
                                </p>
                                <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                                  {paragraph}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <p key={i}>
                              {paragraph}
                            </p>
                          );
                        })}
                      </div>

                      {/* Author stamp / Feedback footer */}
                      <div className="mt-8 pt-4 border-t border-current/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                        <div className="text-[#637062] dark:text-[#87A878]">
                          Published under Open-source Solarpunk license (MIT/CC-BY-SA)
                        </div>
                        <button
                          onClick={() => copySnippet(activeArt.content.join('\n\n'), activeArt.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            copiedCode === activeArt.id
                              ? 'bg-[#2A9D8F] text-white border-transparent'
                              : isNightMode
                              ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                              : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/30'
                          }`}
                        >
                          {copiedCode === activeArt.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode === activeArt.id ? 'Copied Article!' : 'Copy Markdown'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}

        {/* =========================================================================
            SUB-VIEW 3: OFFLINE DOWNLOADS & HARDWARE SETUP
        ========================================================================= */}
        {activeSubView === 'downloads' && (
          <motion.div
            key="downloads-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10"
          >
            {/* Header info */}
            <div className="space-y-2 mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
                <Download className="w-3.5 h-3.5" />
                <span>Offline Packages & Binary Flasher profiles</span>
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
                Offline Installation & Bioregional Downloads
              </h2>
              <p className="text-sm text-[#637062] dark:text-[#A8BDA5] max-w-2xl">
                Prepare your mobile terminal or dedicated hardware router for offline survival. Download offline map bundles, firmware configurations, PWA install shortcuts, and self-hosting containers before going off-grid.
              </p>
            </div>

            {/* PWA Section */}
            <div className="grid md:grid-cols-12 gap-6 items-stretch">
              <div className={`md:col-span-5 p-6 rounded-3xl border flex flex-col justify-between ${
                isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/40 shadow-sm'
              }`}>
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#588157]/25 text-[#588157] dark:text-[#E9C46A] flex items-center justify-center">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-[#203A2A] dark:text-[#F0F5EE]">
                    Progressive Web App (PWA) Install
                  </h3>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                    Once installed as a PWA, HÕIMU caches all codebase files, interface styles, and routing algorithms onto your local drive. It opens instantly and runs at 100% functionality with absolutely zero internet dependency.
                  </p>
                </div>

                <div className="pt-4 border-t border-current/10 mt-6">
                  {isInstalled ? (
                    <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Standalone PWA Active (Running Offline)</span>
                    </div>
                  ) : isInstallable ? (
                    <button
                      onClick={install}
                      className="w-full py-3 px-4 rounded-xl font-display font-bold text-xs bg-[#588157] hover:bg-[#476a46] text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Install Terminal to Device</span>
                    </button>
                  ) : isIOS ? (
                    <button
                      onClick={() => setShowIOSGuide(true)}
                      className="w-full py-3 px-4 rounded-xl font-display font-bold text-xs border border-[#87A878] text-[#588157] dark:text-[#E9C46A] hover:bg-[#588157]/10 transition-all cursor-pointer"
                    >
                      <span>Show iOS Safari Install Guide</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/30 font-mono text-[11px] text-[#637062]">
                      ℹ️ Tap your browser's menu (three dots) and select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong> to run offline.
                    </div>
                  )}
                </div>
              </div>

              {/* Offline Maps section */}
              <div className={`md:col-span-7 p-6 rounded-3xl border space-y-4 flex flex-col justify-between ${
                isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/40 shadow-sm'
              }`}>
                <div className="space-y-2">
                  <h3 className="font-display font-extrabold text-lg text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#2A9D8F]" />
                    <span>Bioregional Offline Map Bundles</span>
                  </h3>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                    Download and pre-cache high-fidelity vector regional maps onto your local terminal. This ensures full topographic and coordinate visibility during outages when standard web tiles are unavailable.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'tartu', label: 'Tartu Watershed & Riverway, EE', size: '24.5 MB', peers: '12 local nodes logged' },
                    { id: 'cascadia', label: 'Cascadia-44N Ridge & Valley, US', size: '45.2 MB', peers: '34 local nodes logged' },
                    { id: 'barcelona', label: 'Barcelona Coastal & Besòs, ES', size: '31.8 MB', peers: '19 local nodes logged' },
                  ].map((mapItem) => {
                    const status = downloadStatus[mapItem.id] || 'idle';
                    const progress = downloadProgress[mapItem.id] || 0;
                    
                    return (
                      <div
                        key={mapItem.id}
                        className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
                          isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                              {mapItem.label}
                            </div>
                            <div className="text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                              {mapItem.size} · {mapItem.peers}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {status === 'idle' && (
                              <button
                                onClick={() => triggerMapDownload(mapItem.id)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#2A9D8F] hover:bg-[#1f776c] text-white flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Get Map</span>
                              </button>
                            )}
                            {status === 'downloading' && (
                              <span className="text-[11px] font-mono text-[#588157] font-semibold">
                                {progress}% Cacheing
                              </span>
                            )}
                            {status === 'completed' && (
                              <span className="text-[11px] font-mono text-emerald-500 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Offline Active</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Animated progress bar */}
                        {status === 'downloading' && (
                          <div className="w-full h-1.5 rounded-full bg-current/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#2A9D8F] to-[#588157] transition-all duration-200"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Hardware Self-Host Config files */}
            <div className={`p-6 sm:p-8 rounded-3xl border space-y-6 ${
              isNightMode ? 'bg-[#182315] border-[#2A3B26]' : 'bg-white border-[#87A878]/40 shadow-sm'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-current/10 pb-4">
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-lg text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
                    <Server className="w-5 h-5 text-[#2A9D8F]" />
                    <span>Dedicated Off-Grid Hardware Configs</span>
                  </h3>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                    Run HÕIMU as a permanent background service on off-grid micro-servers, Raspberry Pis, or Ham-packet modules.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#E9C46A] uppercase">
                  <Cpu className="w-4 h-4 text-[#588157]" />
                  <span>v2.4 Docker Core</span>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Docker Compose Bundle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#588157] dark:text-[#E9C46A] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      <span>docker-compose.yml spec</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copySnippet(dockerComposeSnippet, 'docker')}
                      className={`flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        copiedCode === 'docker'
                          ? 'bg-[#2A9D8F] text-white border-transparent'
                          : isNightMode
                          ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                          : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/30'
                      }`}
                    >
                      {copiedCode === 'docker' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === 'docker' ? 'Copied Compose!' : 'Copy Spec'}</span>
                    </button>
                  </div>

                  <pre className={`p-4 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed h-[240px] border ${
                    isNightMode ? 'bg-[#0E150D] text-[#A8BDA5] border-[#2A3B26]' : 'bg-[#1E2C22] text-[#D4E2D1] border-[#2A3B26]'
                  }`}>
                    {dockerComposeSnippet}
                  </pre>
                </div>

                {/* Shell Script config */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#588157] dark:text-[#E9C46A] flex items-center gap-1.5">
                      <Terminal className="w-4 h-4" />
                      <span>Raspberry Pi Node Setup</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copySnippet(selfHostSnippet, 'bash')}
                      className={`flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        copiedCode === 'bash'
                          ? 'bg-[#2A9D8F] text-white border-transparent'
                          : isNightMode
                          ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                          : 'bg-[#FAF6EE] text-[#637062] border-[#87A878]/30'
                      }`}
                    >
                      {copiedCode === 'bash' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === 'bash' ? 'Copied script!' : 'Copy Script'}</span>
                    </button>
                  </div>

                  <pre className={`p-4 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed h-[240px] border ${
                    isNightMode ? 'bg-[#0E150D] text-[#A8BDA5] border-[#2A3B26]' : 'bg-[#1E2C22] text-[#D4E2D1] border-[#2A3B26]'
                  }`}>
                    {selfHostSnippet}
                  </pre>
                </div>
              </div>

              {/* ESP32 flasher hint */}
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isNightMode ? 'bg-[#121A10]/50 border-[#2A3B26]' : 'bg-[#FAF6EE]/50 border-[#87A878]/25'
              }`}>
                <div className="space-y-1">
                  <div className="font-bold text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-[#E76F51]" />
                    <span>Have a Heltec V3 ESP32 radio module?</span>
                  </div>
                  <p className="text-[#637062] dark:text-[#A8BDA5]">
                    Our direct firmware flashers support flashing packets over BLE. Tune your ESP32 board to 868MHz or 915MHz with one click.
                  </p>
                </div>
                <a
                  href="https://meshtastic.org/docs/getting-started/flashing-firmware/"
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="px-4 py-2 rounded-xl bg-[#203A2A] hover:bg-[#122218] dark:bg-[#E9C46A] dark:hover:bg-[#d4b05a] text-white dark:text-[#182315] font-bold text-xs shrink-0 flex items-center gap-1 transition-all"
                >
                  <span>Open Web Flasher Tool</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          PWA iOS Install Dialog
      ========================================================================= */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A2617]/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#FAF6EE] dark:bg-[#182315] p-6 shadow-xl text-[#203A2A] dark:text-[#F0F5EE] border border-[#87A878]/40">
            <h3 className="text-lg font-bold">Install HÕIMU on Apple iOS</h3>
            <p className="mt-3 text-xs leading-relaxed text-[#637062] dark:text-[#A8BDA5]">
              Due to Apple ecosystem limitations, automatic Web App installation is restricted in some environments. Follow these simple steps:
            </p>
            <div className="mt-4 p-3.5 rounded-xl bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/30 text-xs font-mono space-y-2">
              <div className="flex gap-2">
                <span className="text-[#588157] font-bold">1.</span>
                <span>Tap the <strong className="font-semibold text-[#588157]">Share</strong> (Laadi) icon in the Safari toolbar.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#588157] font-bold">2.</span>
                <span>Scroll down and tap <strong className="font-semibold text-[#588157]">Add to Home Screen</strong> (Lisa avakuvale).</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[#588157] font-bold">3.</span>
                <span>Open HÕIMU from your home screen to run completely offline.</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-[#588157] py-2.5 text-sm font-medium text-white hover:bg-[#3A5A39]"
            >
              Understand & Close
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          CALL TO ACTION & FOOTER
      ========================================================================= */}
      <footer className="py-16 md:py-20 text-center relative overflow-hidden border-t border-current/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#588157] via-[#87A878] to-[#E9C46A] p-0.5 mx-auto shadow-lg flex items-center justify-center">
            <div
              className={`w-full h-full rounded-[22px] flex items-center justify-center ${
                isNightMode ? 'bg-[#182315]' : 'bg-[#FAF6EE]'
              }`}
            >
              <Radio className="w-6 h-6 text-[#588157] dark:text-[#E9C46A] animate-pulse" />
            </div>
          </div>

          <h2 className="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
            Step into the Local Mesh.
          </h2>
          <p className="text-sm text-[#637062] dark:text-[#A8BDA5] max-w-xl mx-auto">
            Your neighborhood, community garden, or bioregion is waiting.
            Open your terminal now to scan for nearby peers and start sharing.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onEnterApp}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-display font-bold text-base bg-[#203A2A] dark:bg-[#E9C46A] text-white dark:text-[#182315] shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>Launch Field Terminal Now</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="pt-12 text-xs font-mono text-[#637062] dark:text-[#87A878] border-t border-current/10 space-y-1">
            <div>Remix HÕIMU · Open Source Solarpunk Mutual Aid · Cascadia 44N</div>
            <div className="text-[11px] opacity-75">100% Zero-Cloud · No Cookies · No Trackers · MIT Licensed</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
