import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Siren, MapPin, Clock, CheckCircle2, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { SOSPacket } from '../types';
import { acknowledgeSos, subscribeToSos } from '../services/utils/sosService';

interface SosAlertBannerProps {
  userCallsign?: string;
  userLat?: number;
  userLng?: number;
  onSelectOnMap?: (lat: number, lng: number) => void;
  isNightMode?: boolean;
}

export const SosAlertBanner: React.FC<SosAlertBannerProps> = ({
  userCallsign = 'USER-NODE',
  userLat = 47.6062,
  userLng = -122.3321,
  onSelectOnMap,
  isNightMode = false,
}) => {
  const [activeAlerts, setActiveAlerts] = useState<SOSPacket[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance between user coordinates and SOS source
  const calculateDistanceKm = useCallback(
    (targetLat: number, targetLng: number) => {
      const R = 6371; // Earth's radius in km
      const dLat = ((targetLat - userLat) * Math.PI) / 180;
      const dLng = ((targetLng - userLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((userLat * Math.PI) / 180) *
          Math.cos((targetLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return (R * c).toFixed(2);
    },
    [userLat, userLng]
  );

  // Play two-tone Web Audio API emergency siren tone
  const playSirenTone = useCallback(() => {
    if (isMuted || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      
      // Siren frequency modulation (880Hz -> 660Hz -> 880Hz)
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Audio playback restriction or error fallback
    }
  }, [isMuted]);

  // Subscribe to SOS emergency service
  useEffect(() => {
    const unsubscribe = subscribeToSos((alerts) => {
      // Filter out self alerts if needed, or show all active alerts
      setActiveAlerts(alerts);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Loop siren sound while active unacknowledged alerts exist
  useEffect(() => {
    // Only play siren if there are unacknowledged alerts from peers (or any unacknowledged active alerts)
    if (activeAlerts.length > 0 && !isMuted) {
      playSirenTone();

      sirenTimerRef.current = setInterval(() => {
        playSirenTone();
      }, 1500);
    } else {
      if (sirenTimerRef.current) {
        clearInterval(sirenTimerRef.current);
        sirenTimerRef.current = null;
      }
    }

    return () => {
      if (sirenTimerRef.current) {
        clearInterval(sirenTimerRef.current);
        sirenTimerRef.current = null;
      }
    };
  }, [activeAlerts, isMuted, playSirenTone]);

  if (activeAlerts.length === 0) {
    return null;
  }

  // Focus on top active alert
  const currentAlert = activeAlerts[0];
  const distanceKm = calculateDistanceKm(currentAlert.lat, currentAlert.lng);
  const alertTimeStr = new Date(currentAlert.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isSelf = currentAlert.from.toLowerCase() === userCallsign.toLowerCase();

  return (
    <div
      id="sos-alert-banner"
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-red-700 via-red-600 to-amber-600 text-white shadow-2xl border-b-2 border-yellow-400 animate-in slide-in-from-top duration-300"
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left SOS Details */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center shrink-0 animate-bounce">
            <Siren className="w-6 h-6 text-yellow-300 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-yellow-400 text-red-950 text-[10px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                🚨 SOS EMERGENCY FLOOD
              </span>
              <span className="font-mono font-bold text-sm tracking-tight text-white">
                {currentAlert.from} {isSelf ? '(YOUR BEACON)' : ''}
              </span>
              <span className="text-xs text-yellow-200 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {alertTimeStr}
              </span>
            </div>

            <p className="text-xs font-medium text-white/95 truncate mt-0.5">
              {currentAlert.reason || 'Immediate Assistance Requested'}
            </p>

            <div className="flex items-center gap-3 text-[11px] font-mono text-yellow-100 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-yellow-300" />
                {distanceKm} km away ({currentAlert.lat.toFixed(4)}, {currentAlert.lng.toFixed(4)})
              </span>
              <span>•</span>
              <span className="text-white/80">Relay TTL: {currentAlert.ttl} Hops</span>
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onSelectOnMap && (
            <button
              type="button"
              onClick={() => onSelectOnMap(currentAlert.lat, currentAlert.lng)}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-white/30"
              title="Locate emergency source on map grid"
            >
              <MapPin className="w-3.5 h-3.5 text-yellow-300" />
              <span className="hidden sm:inline">Show on Map</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/30 text-yellow-300 transition-all cursor-pointer border border-yellow-400/30"
            title={isMuted ? 'Unmute Siren Sound' : 'Mute Siren Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
          </button>

          <button
            id="sos-acknowledge-btn"
            type="button"
            onClick={() => acknowledgeSos(currentAlert.id || currentAlert.from)}
            className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-red-950 font-black text-xs transition-all cursor-pointer shadow-lg flex items-center gap-1.5 active:scale-95 border border-yellow-200"
          >
            <CheckCircle2 className="w-4 h-4 text-red-900" />
            <span>Acknowledge</span>
          </button>
        </div>
      </div>
    </div>
  );
};
