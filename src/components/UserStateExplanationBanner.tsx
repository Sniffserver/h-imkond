/**
 * UserStateExplanationBanner — Explains "Why" when subsystems/features are unavailable.
 * Provides clear context and explicit recovery actions (Show Direction, Enable Location, Repair).
 */

import React from 'react';
import { AlertTriangle, Navigation, MapPin, Wrench, X } from 'lucide-react';

export type UnavailableStateType = 'route_failed' | 'location_unavailable' | 'map_pack_corrupt';

export interface UserStateExplanationProps {
  type: UnavailableStateType;
  onShowDirection?: () => void;
  onEnableLocation?: () => void;
  onRepairMapPack?: () => void;
  onDismiss?: () => void;
}

export const UserStateExplanationBanner: React.FC<UserStateExplanationProps> = ({
  type,
  onShowDirection,
  onEnableLocation,
  onRepairMapPack,
  onDismiss,
}) => {
  if (type === 'route_failed') {
    return (
      <div className="bg-amber-950/90 border border-amber-500/40 text-amber-100 p-4 rounded-lg shadow-xl backdrop-blur-md max-w-md mx-auto my-2">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-200">Offline street routing isn't ready yet.</p>
            <p className="text-xs text-amber-300/80 mt-1">Your map is available.</p>
            <div className="flex items-center space-x-2 mt-3">
              {onShowDirection && (
                <button
                  onClick={onShowDirection}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Show direction</span>
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-3 py-1.5 bg-amber-900/60 hover:bg-amber-800/80 text-amber-200 rounded text-xs font-medium transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-amber-400/60 hover:text-amber-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'location_unavailable') {
    return (
      <div className="bg-blue-950/90 border border-blue-500/40 text-blue-100 p-4 rounded-lg shadow-xl backdrop-blur-md max-w-md mx-auto my-2">
        <div className="flex items-start space-x-3">
          <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-blue-200">GPS unavailable</p>
            <p className="text-xs text-blue-300/80 mt-1">
              The map is still usable. Routes and nearby results use the map center.
            </p>
            <div className="flex items-center space-x-2 mt-3">
              {onEnableLocation && (
                <button
                  onClick={onEnableLocation}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Enable location</span>
                </button>
              )}
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-blue-400/60 hover:text-blue-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'map_pack_corrupt') {
    return (
      <div className="bg-rose-950/90 border border-rose-500/40 text-rose-100 p-4 rounded-lg shadow-xl backdrop-blur-md max-w-md mx-auto my-2">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-rose-200">Map pack damaged</p>
            <p className="text-xs text-rose-300/80 mt-1">Your previous map remains active.</p>
            <div className="flex items-center space-x-2 mt-3">
              {onRepairMapPack && (
                <button
                  onClick={onRepairMapPack}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Repair</span>
                </button>
              )}
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-rose-400/60 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};
