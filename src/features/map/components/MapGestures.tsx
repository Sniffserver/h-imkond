import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MapPin, Navigation, Share2, X, PlusCircle } from 'lucide-react';
import { GeoCoordinate } from '../mapEngine';

export interface MapContextMenuAction {
  label: string;
  icon: React.ReactNode;
  action: (position: GeoCoordinate) => void;
}

export interface MapGesturesProps {
  children: React.ReactNode;
  onPinchZoom?: (scaleMultiplier: number) => void;
  onPan?: (dx: number, dy: number) => void;
  onDoubleTap?: (position: { x: number; y: number }) => void;
  onLongPressCoordinate?: (coord: GeoCoordinate) => void;
  onAddMarker?: (coord: GeoCoordinate) => void;
  onShareLocation?: (coord: GeoCoordinate) => void;
  onNavigateHere?: (coord: GeoCoordinate) => void;
  centerCoordinate?: GeoCoordinate;
  isNightMode?: boolean;
}

export const MapGestures: React.FC<MapGesturesProps> = ({
  children,
  onPinchZoom,
  onPan,
  onDoubleTap,
  onLongPressCoordinate,
  onAddMarker,
  onShareLocation,
  onNavigateHere,
  centerCoordinate = { lat: 59.437, lng: 24.7535 },
  isNightMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture state refs
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialDistanceRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    pixelX: number;
    pixelY: number;
    coord: GeoCoordinate;
  } | null>(null);

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };
      isDraggingRef.current = false;

      // Start Long-Press detection timer (500ms)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        if (!isDraggingRef.current && touchStartRef.current) {
          // Trigger context menu
          const rect = containerRef.current?.getBoundingClientRect();
          const offsetX = touch.clientX - (rect?.left || 0);
          const offsetY = touch.clientY - (rect?.top || 0);

          // Calculate approximate coordinate
          const approxCoord: GeoCoordinate = {
            lat: centerCoordinate.lat + (0.5 - offsetY / (rect?.height || 500)) * 0.05,
            lng: centerCoordinate.lng + (offsetX / (rect?.width || 800) - 0.5) * 0.05,
          };

          setContextMenu({
            visible: true,
            pixelX: Math.min(window.innerWidth - 220, Math.max(16, offsetX)),
            pixelY: Math.min(window.innerHeight - 200, Math.max(16, offsetY)),
            coord: approxCoord,
          });

          if (onLongPressCoordinate) onLongPressCoordinate(approxCoord);
        }
      }, 500);
    } else if (e.touches.length === 2) {
      // Pinch to zoom initiation
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      initialDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isDraggingRef.current = true;
        // Cancel long press if user is panning
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (onPan) onPan(dx * 0.5, dy * 0.5);
      }
    } else if (e.touches.length === 2 && initialDistanceRef.current !== null) {
      const currentDist = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDist / initialDistanceRef.current;

      if (Math.abs(1 - scale) > 0.05) {
        if (onPinchZoom) onPinchZoom(scale > 1 ? 1.05 : 0.95);
        initialDistanceRef.current = currentDist;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    if (e.touches.length === 0 && touchStartRef.current && !isDraggingRef.current) {
      const now = Date.now();
      // Check Double-Tap (within 300ms)
      if (lastTapRef.current && now - lastTapRef.current.time < 300) {
        const distFromLast = Math.hypot(
          touchStartRef.current.x - lastTapRef.current.x,
          touchStartRef.current.y - lastTapRef.current.y
        );

        if (distFromLast < 30) {
          if (onDoubleTap) {
            const rect = containerRef.current?.getBoundingClientRect();
            onDoubleTap({
              x: touchStartRef.current.x - (rect?.left || 0),
              y: touchStartRef.current.y - (rect?.top || 0),
            });
          }
          lastTapRef.current = null;
          return;
        }
      }

      lastTapRef.current = touchStartRef.current;
    }

    initialDistanceRef.current = null;
  };

  const dismissMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="map-gestures-container"
    >
      {children}

      {/* Long-Press Radial / Floating Action Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          role="menu"
          aria-label="Map Coordinate Context Actions"
          style={{ top: `${contextMenu.pixelY}px`, left: `${contextMenu.pixelX}px` }}
          className={`absolute z-50 w-56 p-2 rounded-2xl border shadow-2xl backdrop-blur-md space-y-1 animate-in zoom-in-95 duration-150 ${
            isNightMode
              ? 'bg-[#182315]/95 border-[#2A3B26] text-[#F0F5EE]'
              : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A]'
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1 border-b border-black/10 dark:border-white/10 text-[10px] font-mono text-[#588157] dark:text-[#A8BDA5]">
            <span>{contextMenu.coord.lat.toFixed(4)}°, {contextMenu.coord.lng.toFixed(4)}°</span>
            <button
              type="button"
              onClick={dismissMenu}
              className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close context menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onAddMarker) onAddMarker(contextMenu.coord);
              dismissMenu();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold hover:bg-[#588157]/15 transition-colors cursor-pointer text-left"
          >
            <PlusCircle className="w-4 h-4 text-[#588157]" />
            <span>Add survival marker</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onShareLocation) onShareLocation(contextMenu.coord);
              dismissMenu();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold hover:bg-[#2A9D8F]/15 transition-colors cursor-pointer text-left"
          >
            <Share2 className="w-4 h-4 text-[#2A9D8F]" />
            <span>Share location on mesh</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onNavigateHere) onNavigateHere(contextMenu.coord);
              dismissMenu();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold hover:bg-[#E9C46A]/15 transition-colors cursor-pointer text-left"
          >
            <Navigation className="w-4 h-4 text-[#E9C46A]" />
            <span>Navigate to this point</span>
          </button>
        </div>
      )}
    </div>
  );
};
