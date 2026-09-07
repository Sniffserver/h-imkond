import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Siren, AlertTriangle } from 'lucide-react';
import { broadcastSOS } from '../services/utils/sosService';

interface SosButtonProps {
  userCallsign?: string;
  userLat?: number;
  userLng?: number;
  onSosTriggered?: (reason: string) => void;
  isNightMode?: boolean;
}

export const SosButton: React.FC<SosButtonProps> = ({
  userCallsign = 'USER-NODE',
  userLat,
  userLng,
  onSosTriggered,
  isNightMode = false,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [countdown, setCountdown] = useState(3); // 3, 2, 1
  const [isActivated, setIsActivated] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const HOLD_DURATION_MS = 3000;

  const handleActivation = useCallback(async (reasonText?: string) => {
    setIsActivated(true);

    // Haptic feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 300, 100, 500]);
      } catch {
        // Haptic fallback
      }
    }

    const reason = reasonText || 'EMERGENCY BEACON — Immediate Assistance Requested';
    await broadcastSOS(reason, userLat, userLng);

    if (onSosTriggered) {
      onSosTriggered(reason);
    }

    // Reset button activation state after 3 seconds
    setTimeout(() => {
      setIsActivated(false);
    }, 3000);
  }, [userLat, userLng, onSosTriggered]);

  const clearHolding = useCallback(() => {
    setIsPressing(false);
    setProgress(0);
    setCountdown(3);

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const currentProgress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
    const remainingSeconds = Math.max(1, Math.ceil((HOLD_DURATION_MS - elapsed) / 1000));

    setProgress(currentProgress);
    setCountdown(remainingSeconds);

    if (elapsed < HOLD_DURATION_MS) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      // Completed 3 seconds press and hold!
      clearHolding();
      handleActivation();
    }
  }, [clearHolding, handleActivation]);

  const startHolding = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Prevent default text selection or drag scrolling
      if (e.cancelable) e.preventDefault();

      if (isActivated) return;

      setIsPressing(true);
      startTimeRef.current = Date.now();
      setProgress(0);
      setCountdown(3);

      // Light haptic tick at start
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // Vibrations fallback
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    },
    [isActivated, updateProgress]
  );

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <>
      {/* Permanent SOS Header Button */}
      <div className="relative inline-flex items-center">
        <button
          id="sos-header-button"
          type="button"
          onMouseDown={startHolding}
          onMouseUp={clearHolding}
          onMouseLeave={clearHolding}
          onTouchStart={startHolding}
          onTouchEnd={clearHolding}
          onTouchCancel={clearHolding}
          className={`relative px-3 py-1.5 rounded-xl font-mono font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer select-none overflow-hidden shadow-md ${
            isActivated
              ? 'bg-red-700 text-white animate-bounce ring-4 ring-red-500 shadow-red-600/50'
              : isPressing
              ? 'bg-red-600 text-white scale-105 ring-2 ring-red-400 shadow-lg'
              : 'bg-red-600 hover:bg-red-700 text-white border border-red-400 active:scale-95 shadow-red-900/30'
          }`}
          title="Hold for 3 seconds to broadcast emergency SOS signal across mesh"
        >
          {/* Progress fill overlay */}
          {isPressing && (
            <div
              className="absolute inset-0 bg-red-900/80 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          )}

          <Siren className={`w-4 h-4 z-10 ${isPressing || isActivated ? 'animate-spin' : ''}`} />

          <span className="z-10 tracking-wider">
            {isActivated ? 'SOS SENT!' : isPressing ? `HOLD (${countdown}s)` : 'SOS'}
          </span>

          {/* Pulsing beacon dot */}
          {!isPressing && !isActivated && (
            <span className="relative flex h-2 w-2 z-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
          )}
        </button>

        {/* Floating countdown overlay directly over button during holding */}
        {isPressing && (
          <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 z-50 bg-red-950 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg border border-red-500 shadow-2xl whitespace-nowrap flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
            <span>Transmitting SOS in {countdown}s...</span>
          </div>
        )}
      </div>

      {/* Optional Reason Dialog Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#182315] border-2 border-red-500 rounded-2xl p-5 max-w-sm w-full space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-lg">
              <Siren className="w-6 h-6 animate-pulse" />
              <span>EMERGENCY SOS BROADCAST</span>
            </div>

            <p className="text-xs text-gray-300">
              Your GPS coordinates and node ID (<strong>{userCallsign}</strong>) will be flooded across all nearby 433MHz / BLE radio mesh nodes with MAX priority.
            </p>

            <div>
              <label className="block text-[11px] font-mono text-red-300 mb-1 uppercase tracking-wider">
                Reason / Assistance Needed (Optional):
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g., Medical emergency, severe storm damage, power failure..."
                className="w-full bg-[#121A10] border border-red-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-red-500 h-20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="px-3 py-1.5 rounded-xl border border-gray-600 text-xs font-semibold hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReasonModal(false);
                  handleActivation(reasonInput);
                  setReasonInput('');
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
              >
                <Siren className="w-4 h-4" />
                <span>Broadcasting SOS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
