import React from 'react';
import { MeshNode } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { ReputationPill, getReputationTier, REPUTATION_COLORS } from './ReputationPill';
import { ShieldCheck, Radio, CheckCircle, Activity, X, Info } from 'lucide-react';
import { PeerContributionRadarChart } from './PeerContributionRadarChart';

interface ReputationBreakdownDialogProps {
  peer: MeshNode | null;
  onClose: () => void;
  isNightMode?: boolean;
}

export const ReputationBreakdownDialog: React.FC<ReputationBreakdownDialogProps> = ({
  peer,
  onClose,
  isNightMode = false,
}) => {
  if (!peer) return null;

  const tier = getReputationTier(peer.completedExchanges);
  const tierConfig = REPUTATION_COLORS[tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="reputation-breakdown-dialog"
        className={`w-full max-w-lg max-h-[92vh] rounded-3xl border shadow-2xl p-5 sm:p-6 overflow-y-auto space-y-4 transition-colors ${
          isNightMode
            ? 'bg-[#182315] border-[#2A3B26] text-[#FAF6EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#87A878]/20">
          <div className="flex items-center gap-3">
            <SolarpunkAvatarCanvas seed={peer.avatarSeed} size={48} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-[#203A2A]">
                  {peer.callsign}
                </h3>
                <ReputationPill tier={tier} size="sm" />
              </div>
              <p className="text-xs text-[#588157] font-mono flex items-center gap-1 mt-0.5">
                <Radio className="w-3 h-3 text-[#87A878]" />
                Signal: {peer.lastRssi} dBm • {peer.hopDistance === 1 ? 'Direct Link' : `${peer.hopDistance} Hops`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#637062] hover:bg-[#E6EDE1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white/80 p-3 rounded-2xl border border-[#87A878]/20 text-center">
            <div className="text-[11px] text-[#637062] font-medium flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2A9D8F]" />
              Trust Score
            </div>
            <div className="text-2xl font-bold font-display text-[#203A2A] mt-1">
              {peer.trustScore}
              <span className="text-xs text-[#637062] font-normal">/100</span>
            </div>
          </div>

          <div className="bg-white/80 p-3 rounded-2xl border border-[#87A878]/20 text-center">
            <div className="text-[11px] text-[#637062] font-medium flex items-center justify-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-[#588157]" />
              Exchanges
            </div>
            <div className="text-2xl font-bold font-display text-[#588157] mt-1">
              {peer.completedExchanges}
            </div>
          </div>

          <div className="bg-white/80 p-3 rounded-2xl border border-[#87A878]/20 text-center">
            <div className="text-[11px] text-[#637062] font-medium flex items-center justify-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#E76F51]" />
              Relay Health
            </div>
            <div className="text-2xl font-bold font-display text-[#E76F51] mt-1">
              {peer.relayReliability}%
            </div>
          </div>
        </div>

        {/* Mini Graph of Recent Mesh Epochs */}
        <div className="bg-white/70 p-3.5 rounded-2xl border border-[#87A878]/20">
          <div className="flex items-center justify-between text-xs font-semibold text-[#203A2A] mb-2">
            <span>Observed Relay Reliability</span>
            <span className="text-[11px] font-mono text-[#588157]">Recent Epochs</span>
          </div>

          <div className="h-16 flex items-end gap-2 pt-2 px-1">
            {peer.recentInteractions.map((val, idx) => {
              const heightPct = Math.max(18, (val / 100) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[9px] font-mono text-[#637062] opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}%
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-t-md bg-gradient-to-t from-[#87A878] to-[#E9C46A] group-hover:from-[#2A9D8F] group-hover:to-[#87A878] transition-all"
                  />
                  <div className="text-[9px] font-mono text-[#7C8C77]">
                    T-{peer.recentInteractions.length - idx}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Community Contribution Radar Chart */}
        <PeerContributionRadarChart
          peer={peer}
          isNightMode={isNightMode}
          compact={true}
        />

        {/* Mandatory Non-Clinical / Decentralized Local Estimate Note */}
        <div className="bg-[#FAF6EE] p-3 rounded-2xl border border-[#87A878]/30 flex items-start gap-2 text-xs text-[#637062] leading-relaxed">
          <Info className="w-4 h-4 text-[#588157] shrink-0 mt-0.5" />
          <p>
            <strong>Local mesh reputation estimate</strong> based on observed peer-to-peer relay telemetry and mutual aid history. No centralized identity, credit score, or legal verification.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#203A2A] hover:bg-[#16271c] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
