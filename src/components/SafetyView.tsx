import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Radio,
  Cpu,
  HelpCircle,
  CheckCircle2,
  PhoneCall,
  Activity,
} from 'lucide-react';
import { CrisisAlert, NavTab } from '../types';

interface SafetyViewProps {
  isCrisisMode: boolean;
  onToggleCrisisMode: () => void;
  crisisAlerts: CrisisAlert[];
  onBroadcastAlert: (alert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => void;
  onResolveAlert: (id: string) => void;
  onOpenDiagnostics: () => void;
  onOpenManual: () => void;
  isNightMode?: boolean;
}

export const SafetyView: React.FC<SafetyViewProps> = ({
  isCrisisMode,
  onToggleCrisisMode,
  crisisAlerts,
  onBroadcastAlert,
  onResolveAlert,
  onOpenDiagnostics,
  onOpenManual,
  isNightMode = false,
}) => {
  const activeAlerts = crisisAlerts.filter((a) => !a.resolved);

  return (
    <div
      role="region"
      aria-label="Field Safety & Emergency Center"
      className="space-y-4 pb-4 animate-fadeIn"
    >
      {/* Emergency Header Card */}
      <div
        className={`p-6 rounded-3xl border shadow-md relative overflow-hidden transition-all ${
          isCrisisMode
            ? 'bg-[#E76F51] border-red-600 text-white'
            : isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isCrisisMode
                  ? 'bg-white text-[#E76F51]'
                  : isNightMode
                  ? 'bg-[#2A3B26] text-[#E76F51]'
                  : 'bg-[#E76F51]/15 text-[#E76F51]'
              }`}
            >
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg sm:text-xl">
                Field Safety & Emergency Hub
              </h2>
              <p
                className={`text-xs mt-0.5 ${
                  isCrisisMode
                    ? 'text-white/90 font-medium'
                    : 'text-[#637062] dark:text-[#A8BDA5]'
                }`}
              >
                100% Zero-Cloud Emergency SOS and Mesh Alert Dispatch
              </p>
            </div>
          </div>
        </div>

        {/* SOS Primary Button */}
        <div className="p-4 rounded-2xl bg-black/10 dark:bg-white/10 border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm">
              {isCrisisMode ? '🚨 Emergency SOS Broadcast ACTIVE' : 'Broadcast Emergency Distress Beacon'}
            </h3>
            <p className="text-xs opacity-80 mt-0.5">
              Sends encrypted SOS packet with your GPS coordinates across all nearby 868MHz LoRa & BLE nodes.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleCrisisMode}
            className={`px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer shrink-0 ${
              isCrisisMode
                ? 'bg-white text-[#E76F51] hover:bg-red-50'
                : 'bg-[#E76F51] text-white hover:bg-[#D65D3F]'
            }`}
          >
            {isCrisisMode ? 'Deactivate SOS' : 'Trigger SOS Alert'}
          </button>
        </div>
      </div>

      {/* Active Alerts List */}
      <div
        className={`p-5 rounded-3xl border ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/30 text-[#203A2A]'
        }`}
      >
        <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#E76F51]" />
          <span>Active Field Alerts ({activeAlerts.length})</span>
        </h3>

        {activeAlerts.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#588157]/10 text-xs text-[#3A4A38] dark:text-[#A8BDA5] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#588157] shrink-0" />
            <span>No active emergency alerts in your local mesh zone. All clear.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3.5 rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-700 dark:text-red-300 uppercase font-mono text-[10px]">
                      {alert.severity || alert.type || 'EMERGENCY'}
                    </span>
                    <span className="text-[#637062] dark:text-[#A8BDA5]">
                      From {alert.senderCallsign || alert.authorCallsign || 'Mesh Peer'} • {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-medium mt-1 text-[#203A2A] dark:text-white">
                    {alert.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onResolveAlert(alert.id)}
                  className="px-2.5 py-1 rounded-xl bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200 font-bold text-[10px] hover:underline shrink-0 cursor-pointer"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety Links & Home Hub Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenDiagnostics}
          className={`p-4 rounded-3xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30] hover:bg-[#223120] text-[#F0F5EE]'
              : 'bg-white border-[#87A878]/30 hover:bg-[#FAF6EE] text-[#203A2A]'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-[#588157]/15 text-[#588157] flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Home Hub (Pi Bridge) Status</h4>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5">
              Verify 868MHz LoRa radio link & battery power
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenManual}
          className={`p-4 rounded-3xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30] hover:bg-[#223120] text-[#F0F5EE]'
              : 'bg-white border-[#87A878]/30 hover:bg-[#FAF6EE] text-[#203A2A]'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-[#E9C46A]/20 text-[#E9C46A] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Offline Survival Manual</h4>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5">
              Emergency medical, water filtration, & radio guides
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
