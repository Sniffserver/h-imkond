import React, { useState } from 'react';
import {
  X,
  Radio,
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
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface HoimuLandingPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullLandingPage?: () => void;
  isNightMode?: boolean;
}

export const HoimuLandingPageModal: React.FC<HoimuLandingPageModalProps> = ({
  isOpen,
  onClose,
  onOpenFullLandingPage,
  isNightMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'manifesto' | 'pwa' | 'selfhost' | 'api'>('manifesto');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const serverCodeSnippet = `// express-hoimu-sync-node.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let meshLedger = [];

app.post('/api/v1/sync', (req, res) => {
  const { nodeCallsign, localTransactions, timestamp } = req.body;
  // Merge CRDT transactions
  meshLedger = [...new Set([...meshLedger, ...(localTransactions || [])])];
  console.log(\`[HOIMU NODE] Synced \${localTransactions?.length || 0} records from \${nodeCallsign}\`);
  res.json({ status: 'OK', ledgerCount: meshLedger.length, timestamp: Date.now() });
});

app.listen(3000, '0.0.0.0', () => console.log('⚡ HÕIMU Self-Hosted Mesh Sync Server running on port 3000'));`;

  const copySnippet = () => {
    navigator.clipboard.writeText(serverCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 max-h-[92vh] flex flex-col ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {onOpenFullLandingPage && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFullLandingPage();
            }}
            className={`absolute top-4 right-14 px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isNightMode
                ? 'bg-[#182315] text-[#E9C46A] border-[#364E30] hover:bg-[#2A3B26]'
                : 'bg-[#588157]/10 text-[#588157] border-[#588157]/30 hover:bg-[#588157]/20'
            }`}
            title="Open full interactive landing page view"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Interactive Landing Page</span>
          </button>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4 shrink-0 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-[#588157] text-white flex items-center justify-center shadow-md">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-extrabold text-2xl tracking-tight">HÕIMU Field Manual</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#87A878]/30 text-[#588157] dark:text-[#87A878]">
                v2.4 Solarpunk
              </span>
            </div>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Offline Mutual-Aid Mesh & Self-Hosting Guide for Resilient Local Communities.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4 border-b border-current/10 pb-3 shrink-0 text-xs font-bold">
          {[
            { id: 'manifesto', label: '🌿 Solarpunk Manifesto', icon: BookOpen },
            { id: 'pwa', label: '📱 PWA Installation', icon: Download },
            { id: 'selfhost', label: '⚡ Self-Hosting Node', icon: Server },
            { id: 'api', label: '🔒 CRDT & Privacy', icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#203A2A] text-white shadow-xs'
                    : isNightMode
                    ? 'bg-[#121A10] text-[#A8BDA5] hover:text-white'
                    : 'bg-white text-[#637062] border border-[#87A878]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? '#E9C46A' : undefined }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-4">
          {activeTab === 'manifesto' && (
            <div className="space-y-3.5 text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              <div className="p-4 rounded-2xl bg-[#588157]/15 border border-[#87A878]/30 text-[#203A2A] dark:text-[#F0F5EE] space-y-2">
                <h3 className="font-display font-bold text-base text-[#588157] dark:text-[#87A878]">
                  Mis on HÕIMU? / What is HÕIMU?
                </h3>
                <p>
                  HÕIMU is an off-grid mutual-aid mesh operating on peer-to-peer radio frequency (LoRa, BLE, local Wi-Fi). It empowers resilient bioregional communities to share energy, equipment, food, and expertise without relying on centralized corporate clouds or vulnerable cellular towers.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-current/10 bg-white/50 dark:bg-[#121A10]/50 space-y-1">
                  <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
                    Maine Põhine (Reputation-Based)
                  </h4>
                  <p>
                    Decisions and voting weight in Bioregional DAOs scale with mutual aid contributions (Symbiosis Score), keeping governance firmly in the hands of active caretakers rather than financial capital.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-current/10 bg-white/50 dark:bg-[#121A10]/50 space-y-1">
                  <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#E76F51]" />
                    Privaatsus Ennekõike (Zero Cloud)
                  </h4>
                  <p>
                    All data resides locally on your device in encrypted IndexedDB/localStorage. Signatures use standard Ed25519 cryptography with zero personal data leakage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4 text-xs text-[#637062] dark:text-[#A8BDA5]">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 space-y-2">
                <h3 className="font-display font-bold text-sm text-[#588157] flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-[#2A9D8F]" />
                  Install as Standalone Offline PWA Application
                </h3>
                <p>
                  HÕIMU is fully packaged with a service worker and Web App Manifest. You can install it on iOS, Android, macOS, Linux, or Windows to run fully offline without browser address bars.
                </p>
              </div>

              <div className="space-y-2 font-mono">
                <div className="p-3 rounded-xl border border-current/10 bg-[#588157]/10 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#588157] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">On Chrome / Android / Edge:</h4>
                    <p className="text-[11px]">Click the Install icon in the address bar or select "Add to Home Screen".</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-current/10 bg-[#588157]/10 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#588157] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">On Safari / iOS:</h4>
                    <p className="text-[11px]">Tap the Share button → Select "Add to Home Screen" (Lisa avakuvale).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'selfhost' && (
            <div className="space-y-3.5 text-xs text-[#637062] dark:text-[#A8BDA5]">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-[#588157] flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-[#E9C46A]" />
                  Self-Hosted Node Server (Express + SQLite)
                </h3>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="px-2.5 py-1 rounded-lg bg-[#588157] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-[#466845]"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <p>
                Run a dedicated lightweight synchronization node on a Raspberry Pi, solar router, or home server to act as a permanent store-and-forward relay node for your community mesh.
              </p>

              <pre className="p-3.5 rounded-2xl bg-[#0F170D] text-[#87A878] font-mono text-[11px] overflow-x-auto border border-[#2A3B26] leading-relaxed">
                <code>{serverCodeSnippet}</code>
              </pre>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-3 text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#121A10] border border-current/10 space-y-1">
                <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#2A9D8F]" />
                  Conflict-free Replicated Data Types (CRDTs)
                </h4>
                <p>
                  HÕIMU relies on state-based CRDTs (LWW-Element-Set) so that multiple offline peers can issue resource proposals or vote offline, merging state automatically whenever radio contact is restored.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#121A10] border border-current/10 space-y-1">
                <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#F4A261]" />
                  Matrix & libp2p Relay Compatibility
                </h4>
                <p>
                  Packet schemas are fully serializable to 128-byte binary blobs, compatible with Meshtastic protobufs, libp2p pubsub, and local Matrix federation protocols.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
