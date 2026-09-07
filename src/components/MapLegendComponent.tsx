import React, { useState } from 'react';
import {
  Layers,
  Zap,
  Wrench,
  Wheat,
  GraduationCap,
  Home,
  HeartPulse,
  Radio,
  Signal,
  Boxes,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
} from 'lucide-react';
import { ResourceCategory } from '../types';

export interface MapLegendComponentProps {
  isNightMode?: boolean;
  isOpen: boolean;
  onClose?: () => void;
  isFloating?: boolean;
  className?: string;
}

export const MapLegendComponent: React.FC<MapLegendComponentProps> = ({
  isNightMode = false,
  isOpen,
  onClose,
  isFloating = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'resources' | 'peers' | 'signal'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      id="bioregional-map-legend-panel"
      className={`rounded-2xl border backdrop-blur-md shadow-xl transition-all z-30 ${
        isNightMode
          ? 'bg-[#182315]/95 border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A]'
      } ${
        isFloating
          ? 'absolute bottom-6 left-6 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] max-h-[70vh] overflow-hidden flex flex-col'
          : 'w-full'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-inherit/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#588157]/20 flex items-center justify-center text-[#588157]">
            <Layers className="w-3.5 h-3.5 text-[#2A9D8F]" />
          </div>
          <div>
            <h3 className="font-bold text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
              <span>Kaardi Legend & Markerite Seletus</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#E9C46A]/20 text-[#D4A373] font-semibold">
                Field Guide
              </span>
            </h3>
            <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] leading-tight">
              Sõlmede, ressursside ja raadioteede visuaalsed tähised
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Laienda legend' : 'Ahenda legend'}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-inherit/70 cursor-pointer transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Sulge legend"
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-inherit/70 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 sm:p-4 space-y-3.5 overflow-y-auto max-h-[60vh]">
          {/* Quick Category Filter Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 border border-inherit/20 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#203A2A] text-[#2A9D8F] dark:text-[#E9C46A] shadow-2xs font-bold'
                  : 'text-inherit/70 hover:text-inherit'
              }`}
            >
              Kõik
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('peers')}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'peers'
                  ? 'bg-white dark:bg-[#203A2A] text-[#588157] dark:text-[#87A878] shadow-2xs font-bold'
                  : 'text-inherit/70 hover:text-inherit'
              }`}
            >
              Võrgusõlmed
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signal')}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'signal'
                  ? 'bg-white dark:bg-[#203A2A] text-[#2A9D8F] dark:text-[#2A9D8F] shadow-2xs font-bold'
                  : 'text-inherit/70 hover:text-inherit'
              }`}
            >
              Signaalitee (RSSI)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('resources')}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'resources'
                  ? 'bg-white dark:bg-[#203A2A] text-[#E76F51] dark:text-[#F4A261] shadow-2xs font-bold'
                  : 'text-inherit/70 hover:text-inherit'
              }`}
            >
              Ressursid
            </button>
          </div>

          {/* SECTION 1: PEER RELAY NODES */}
          {(activeTab === 'all' || activeTab === 'peers') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#588157] dark:text-[#87A878] border-b border-inherit/20 pb-1">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Võrgusõlmed & Releed (Peer Relay Nodes)</span>
                </span>
                <span className="text-[10px] font-mono text-inherit/60">Mesh Topology</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Local User Node */}
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="relative shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
                    <span className="w-5 h-5 rounded-full border-2 border-[#E9C46A] bg-[#203A2A] flex items-center justify-center shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-[#E9C46A]" />
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[11px] text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1">
                      <span>Kohalik sõlm (You / GPS Node)</span>
                    </div>
                    <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] leading-tight">
                      Sinu seadme RF saatja ja GPS asukoht kaardil
                    </p>
                  </div>
                </div>

                {/* Direct Peer (1-Hop) */}
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="relative shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
                    <span className="w-4.5 h-4.5 rounded-full border-2 border-[#588157] bg-white dark:bg-[#182315] flex items-center justify-center shadow-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#87A878]" />
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[11px] text-[#588157] dark:text-[#87A878] flex items-center gap-1">
                      <span>Otsene naabersõlm (Direct)</span>
                      <span className="text-[9px] font-mono px-1 rounded bg-[#588157]/15">1-Hop</span>
                    </div>
                    <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] leading-tight">
                      Otseses raadioulatuses (BLE/LoRa) töötav aktiivne sõlm
                    </p>
                  </div>
                </div>

                {/* Relayed Peer (2-Hop) */}
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="relative shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
                    <span className="w-4.5 h-4.5 rounded-full border-2 border-[#F4A261] bg-white dark:bg-[#182315] flex items-center justify-center shadow-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F4A261]" />
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[11px] text-[#F4A261] flex items-center gap-1">
                      <span>Vahendatud relee (Relayed)</span>
                      <span className="text-[9px] font-mono px-1 rounded bg-[#F4A261]/15">2-Hops</span>
                    </div>
                    <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] leading-tight">
                      Edastatakse vahepealsete releesõlmede kaudu
                    </p>
                  </div>
                </div>

                {/* Store & Forward (3+ Hops) */}
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="relative shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
                    <span className="w-4.5 h-4.5 rounded-full border-2 border-[#E76F51] bg-white dark:bg-[#182315] flex items-center justify-center shadow-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51]" />
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[11px] text-[#E76F51] flex items-center gap-1">
                      <span>Talleta & edasta (Store/Fwd)</span>
                      <span className="text-[9px] font-mono px-1 rounded bg-[#E76F51]/15">3+ Hops</span>
                    </div>
                    <p className="text-[10px] text-[#637062] dark:text-[#A8BDA5] leading-tight">
                      Kaugem sõlm, andmepaketid liiguvad puhverdatult
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: SIGNAL PATH STRENGTHS (RSSI & Mesh Health) */}
          {(activeTab === 'all' || activeTab === 'signal') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#2A9D8F] dark:text-[#2A9D8F] border-b border-inherit/20 pb-1">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Raadiotee Signaalitugevus & Töökindlus (Mesh Health)</span>
                </span>
                <span className="text-[10px] font-mono text-inherit/60">RF Link Quality</span>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* Optimal / Strong (>= -60 dBm) */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <span className="w-full h-1 rounded-full bg-[#2A9D8F] shadow-xs" />
                    </div>
                    <div>
                      <div className="font-bold text-[11px] text-[#2A9D8F]">Tipptase (Optimal / Strong)</div>
                      <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                        Kõrge läbipaistmatus (90%), pidev ja kiire andmevahetus
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[#2A9D8F]/15 text-[#2A9D8F]">
                    &ge; -60 dBm
                  </span>
                </div>

                {/* Good (-61 to -72 dBm) */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <span className="w-full h-0.75 rounded-full bg-[#588157]" />
                    </div>
                    <div>
                      <div className="font-bold text-[11px] text-[#588157] dark:text-[#87A878]">Hea (Good Link)</div>
                      <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                        Stabiilne roheline ühendusjoon, usaldusväärne levi
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[#588157]/15 text-[#588157] dark:text-[#87A878]">
                    -61..-72 dBm
                  </span>
                </div>

                {/* Moderate (-73 to -82 dBm) */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <span className="w-full h-0.75 border-b-2 border-dashed border-[#E9C46A]" />
                    </div>
                    <div>
                      <div className="font-bold text-[11px] text-[#D4A373] dark:text-[#E9C46A]">Rahuldav (Moderate)</div>
                      <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                        Katkendlik kollane joon, keskmine signaalisummutus
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[#E9C46A]/20 text-[#D4A373] dark:text-[#E9C46A]">
                    -73..-82 dBm
                  </span>
                </div>

                {/* Weak / Fringe (< -83 dBm) */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-inherit/20">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <span className="w-full h-0.5 border-b border-dotted border-[#E76F51] opacity-60" />
                    </div>
                    <div>
                      <div className="font-bold text-[11px] text-[#E76F51]">Nõrk / Piiripealne (Fringe)</div>
                      <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                        Madal läbipaistvus (30-45%), signaal vajab kordussaatmisi
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-[#E76F51]/15 text-[#E76F51]">
                    &lt; -83 dBm
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: RESOURCE NODE CATEGORIES */}
          {(activeTab === 'all' || activeTab === 'resources') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#E76F51] dark:text-[#F4A261] border-b border-inherit/20 pb-1">
                <span className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Kogukonna Ressursid & Huvipunktid (Resource Nodes)</span>
                </span>
                <span className="text-[10px] font-mono text-inherit/60">Assets & POIs</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Energy */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#F4A261]/20 flex items-center justify-center text-[#F4A261] shrink-0 font-bold">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Energia (Energy)</div>
                    <div className="text-[9px] text-inherit/70">Päike, aku, genekas</div>
                  </div>
                </div>

                {/* Tools */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#2A9D8F]/20 flex items-center justify-center text-[#2A9D8F] shrink-0 font-bold">
                    <Wrench className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Tööriistad (Tools)</div>
                    <div className="text-[9px] text-inherit/70">Töökoja riistad, seadmed</div>
                  </div>
                </div>

                {/* Food */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#87A878]/20 flex items-center justify-center text-[#87A878] shrink-0 font-bold">
                    <Wheat className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Toit & Vesi (Food)</div>
                    <div className="text-[9px] text-inherit/70">Puhas vesi, toiduvaru</div>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#E9C46A]/20 flex items-center justify-center text-[#E9C46A] shrink-0 font-bold">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Oskused (Skills)</div>
                    <div className="text-[9px] text-inherit/70">Teadmus, koolitused</div>
                  </div>
                </div>

                {/* Housing */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#588157]/20 flex items-center justify-center text-[#588157] shrink-0 font-bold">
                    <Home className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Hool & Ruum (Care)</div>
                    <div className="text-[9px] text-inherit/70">Varjupaik, ruumid</div>
                  </div>
                </div>

                {/* Bio-Remedy */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#E76F51]/20 flex items-center justify-center text-[#E76F51] shrink-0 font-bold">
                    <HeartPulse className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Bio-Ravi (Health)</div>
                    <div className="text-[9px] text-inherit/70">Ravimtaimed, esmaabi</div>
                  </div>
                </div>

                {/* Electronics */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-lg bg-[#6366F1]/20 flex items-center justify-center text-[#6366F1] shrink-0 font-bold">
                    <Radio className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Elektroonika (Comms)</div>
                    <div className="text-[9px] text-inherit/70">LoRa seadmed, akud</div>
                  </div>
                </div>

                {/* Resource Clusters */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-inherit/20">
                  <span className="w-6 h-6 rounded-full bg-[#2A9D8F] flex items-center justify-center text-white shrink-0 font-mono font-bold text-[10px] shadow-xs">
                    +4
                  </span>
                  <div>
                    <div className="font-bold text-[11px]">Ressursiklastrid</div>
                    <div className="text-[9px] text-inherit/70">Grupeeritud nööpnõelad</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick navigation & centering tip */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#588157]/10 border border-[#588157]/30 text-[10px] text-[#588157] dark:text-[#87A878]">
            <LocateFixed className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>Välitöö vihje:</strong> Vajuta <strong>'C'</strong> või kaardinupule <strong>'Center on My Node'</strong>, et vaade koheselt oma GPS asukohale tsentreerida ja suumida.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
