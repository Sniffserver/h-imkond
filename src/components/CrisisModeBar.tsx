import React, { useState } from 'react';
import { CrisisAlert } from '../types';
import {
  AlertTriangle,
  Siren,
  Radio,
  Flame,
  HeartPulse,
  Waves,
  ZapOff,
  Search,
  Volume2,
  X,
  Send,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface CrisisModeBarProps {
  isCrisisMode: boolean;
  onToggleCrisisMode: () => void;
  crisisAlerts: CrisisAlert[];
  onBroadcastAlert: (newAlert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => void;
  onResolveAlert: (alertId: string) => void;
  userCallsign: string;
  isNightMode?: boolean;
}

export const CrisisModeBar: React.FC<CrisisModeBarProps> = ({
  isCrisisMode,
  onToggleCrisisMode,
  crisisAlerts,
  onBroadcastAlert,
  onResolveAlert,
  userCallsign,
  isNightMode = false,
}) => {
  const [showSosModal, setShowSosModal] = useState(false);
  const [alertType, setAlertType] = useState<CrisisAlert['type']>('Medical');
  const [severity, setSeverity] = useState<CrisisAlert['severity']>('Critical');
  const [message, setMessage] = useState('');
  const [locationName, setLocationName] = useState('Cascadia Node 01 (Home)');

  const activeAlerts = crisisAlerts.filter((a) => !a.resolved);

  const handleSendSos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    onBroadcastAlert({
      senderCallsign: userCallsign,
      type: alertType,
      severity,
      message: message.trim(),
      locationName,
      radioChannel: '433.075 MHz / BLE Ch 38',
    });

    setMessage('');
    setShowSosModal(false);
  };

  const alertIcons: Record<string, React.ReactNode> = {
    Medical: <HeartPulse className="w-4 h-4 text-red-500" />,
    'Power Outage': <ZapOff className="w-4 h-4 text-amber-500" />,
    'Search & Rescue': <Search className="w-4 h-4 text-blue-500" />,
    Flood: <Waves className="w-4 h-4 text-cyan-500" />,
    Fire: <Flame className="w-4 h-4 text-orange-500" />,
    Other: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    medical: <HeartPulse className="w-4 h-4 text-red-500" />,
    power: <ZapOff className="w-4 h-4 text-amber-500" />,
    shelter: <ShieldAlert className="w-4 h-4 text-emerald-500" />,
    evacuation: <Siren className="w-4 h-4 text-red-500" />,
    comms: <Radio className="w-4 h-4 text-purple-500" />,
    general: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  };

  return (
    <div className="w-full space-y-3">
      {/* Top Banner Control Switch */}
      <div
        className={`p-3.5 sm:p-4 rounded-3xl border transition-all duration-300 flex flex-wrap items-center justify-between gap-3 ${
          isCrisisMode
            ? 'bg-red-900/90 border-red-500 text-white shadow-xl ring-2 ring-red-500/50 animate-pulse'
            : isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-white border-[#87A878]/40 text-[#203A2A] shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
              isCrisisMode ? 'bg-red-600 text-white animate-bounce' : 'bg-[#E76F51]/20 text-[#E76F51]'
            }`}
          >
            <Siren className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-sm sm:text-base">
                {isCrisisMode ? '🚨 KRIISIREŽIIM AKTIIVNE / CRISIS MODE ACTIVE' : 'Kriisirežiim / Crisis Mode'}
              </h3>
              {activeAlerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-600 text-white">
                  {activeAlerts.length} SOS Alerts
                </span>
              )}
            </div>
            <p className="text-xs opacity-90">
              {isCrisisMode
                ? 'High-contrast emergency interface. All mesh priority queues set to 0ms priority beaconing.'
                : 'Simplified high-contrast mode with direct SOS emergency alert broadcasting.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCrisisMode && (
            <button
              type="button"
              onClick={() => setShowSosModal(true)}
              className="px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg border border-red-400 cursor-pointer animate-pulse"
            >
              <Siren className="w-4 h-4" />
              <span>Broadcast SOS Alert</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCrisisMode}
            className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
              isCrisisMode
                ? 'bg-white text-red-900 border-white hover:bg-red-100'
                : 'bg-[#E76F51] hover:bg-[#d65f41] text-white border-[#E76F51] shadow-xs'
            }`}
          >
            {isCrisisMode ? 'Deactivate Crisis Mode' : 'Lülita Kriisirežiim / Enable Crisis Mode'}
          </button>
        </div>
      </div>

      {/* Active Emergency Alerts Bar */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3.5 rounded-2xl bg-red-950/90 border-2 border-red-600 text-white flex flex-wrap items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-red-800 text-white shrink-0 mt-0.5">
                  {alertIcons[alert.type]}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-xs uppercase bg-red-600 px-2 py-0.5 rounded-md">
                      {alert.severity} • {alert.type}
                    </span>
                    <span className="text-xs font-mono text-red-200">
                      From: {alert.senderCallsign} ({alert.locationName})
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-red-100">{alert.message}</p>
                  <div className="text-[10px] font-mono text-red-300 mt-1 flex items-center gap-2">
                    <Radio className="w-3 h-3" /> Radio: {alert.radioChannel}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onResolveAlert(alert.id)}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SOS Alert Broadcast Modal */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border-2 border-red-600 bg-red-950 text-white p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setShowSosModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-red-800 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-600 text-white animate-bounce">
                <Siren className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg uppercase tracking-wider text-red-100">
                  Broadcast Emergency Mesh Alert
                </h3>
                <p className="text-xs text-red-200">
                  This message will be instantly flooded across all peer hops & BLE mesh channels.
                </p>
              </div>
            </div>

            <form onSubmit={handleSendSos} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-red-200 mb-1">Emergency Type:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Medical', 'Power Outage', 'Search & Rescue', 'Flood', 'Fire', 'Other'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAlertType(t)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        alertType === t
                          ? 'bg-red-600 text-white border-white shadow-md'
                          : 'bg-red-900/60 text-red-200 border-red-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-red-200 mb-1">Severity Level:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Moderate', 'High', 'Critical'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        severity === s
                          ? 'bg-red-500 text-white border-white'
                          : 'bg-red-900/60 text-red-200 border-red-800'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-red-200 mb-1">Emergency Message:</label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Urgent medical assistance needed at South Bridge Node. Oxygen cylinder or responder required."
                  className="w-full p-3 rounded-xl bg-red-900 border border-red-700 text-white text-xs focus:outline-hidden focus:border-red-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-red-200 mb-1">Location Coordinates/Node:</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-red-900 border border-red-700 text-white text-xs focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={!message.trim()}
                className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl border border-red-400 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Transmit Emergency SOS Beacon</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
