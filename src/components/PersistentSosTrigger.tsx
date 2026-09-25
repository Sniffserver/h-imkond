import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Siren } from 'lucide-react';
import { broadcastSOS } from '../services/utils/sosService';

interface PersistentSosTriggerProps {
  userLat?: number;
  userLng?: number;
  onSosTriggered?: (reason: string) => void;
  isNightMode?: boolean;
}

export const PersistentSosTrigger: React.FC<PersistentSosTriggerProps> = ({
  userLat,
  userLng,
  onSosTriggered,
  isNightMode = false,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isTriggered, setIsTriggered] = useState(false);

  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const HOLD_DURATION_MS = 2000; // 2 seconds hold as requested

  const executeBroadcast = useCallback(async () => {
    setIsTriggered(true);

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([300, 100, 300, 100, 500]);
      } catch {}
    }

    const reason = 'EMERGENCY BEACON — 2s Hold Broadcast Dispatched';
    await broadcastSOS(reason, userLat, userLng);
    onSosTriggered?.(reason);

    setTimeout(() => {
      setIsTriggered(false);
      setProgress(0);
    }, 4000);
  }, [userLat, userLng, onSosTriggered]);

  const stopHolding = useCallback(() => {
    setIsPressing(false);
    setProgress(0);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const updateHoldLoop = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const p = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
    setProgress(p);

    if (elapsed >= HOLD_DURATION_MS) {
      stopHolding();
      executeBroadcast();
    } else {
      animFrameRef.current = requestAnimationFrame(updateHoldLoop);
    }
  }, [executeBroadcast, stopHolding]);

  const startHolding = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (e.cancelable) e.preventDefault();
      if (isTriggered) return;

      setIsPressing(true);
      startTimeRef.current = Date.now();
      setProgress(0);
      animFrameRef.current = requestAnimationFrame(updateHoldLoop);
    },
    [isTriggered, updateHoldLoop]
  );

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="fixed bottom-20 left-4 z-40 select-none">
      <div className="relative flex items-center justify-center">
        {/* Circular Progress Ring when holding */}
        {isPressing && (
          <svg className="absolute -inset-1.5 w-[56px] h-[56px] -rotate-90 pointer-events-none">
            <circle
              cx="28"
              cy="28"
              r="24"
              className="text-red-950/40 stroke-current"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="28"
              cy="28"
              r="24"
              className="text-red-500 stroke-current transition-all duration-75"
              strokeWidth="4"
              strokeDasharray={150.8}
              strokeDashoffset={150.8 - (150.8 * progress) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
        )}

        <button
          type="button"
          id="persistent-floating-sos-btn"
          aria-label="Hold 2 seconds to Broadcast Emergency SOS"
          onMouseDown={startHolding}
          onMouseUp={stopHolding}
          onMouseLeave={stopHolding}
          onTouchStart={startHolding}
          onTouchEnd={stopHolding}
          onTouchCancel={stopHolding}
          className={`relative w-11 h-11 rounded-full flex flex-col items-center justify-center font-mono font-bold text-[11px] shadow-lg transition-transform active:scale-90 cursor-pointer ${
            isTriggered
              ? 'bg-red-700 text-white animate-bounce ring-4 ring-red-400'
              : isPressing
              ? 'bg-red-600 text-white scale-105 shadow-red-500/50'
              : isNightMode
              ? 'bg-[#2A1012] border border-[#5A1C20] text-red-400 hover:bg-[#3D1418]'
              : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 shadow-md'
          }`}
          title="Hold 2 seconds to broadcast emergency SOS"
        >
          <Siren className={`w-4 h-4 ${isPressing ? 'animate-pulse text-white' : ''}`} />
          <span className="text-[8px] tracking-tighter leading-none mt-0.5">SOS</span>
        </button>
      </div>

      {isPressing && (
        <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-black/90 text-white text-[11px] font-mono px-2.5 py-1 rounded-md whitespace-nowrap shadow-md pointer-events-none border border-red-500/40 animate-pulse">
          Hold 2s to broadcast...
        </div>
      )}
    </div>
  );
};
