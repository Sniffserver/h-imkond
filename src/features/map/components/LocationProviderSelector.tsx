import React, { useState, useEffect } from 'react';
import { locationManager } from '../../../services/location/LocationManager';
import { LocationProviderType, LocationProviderInfo } from '../../../services/location/LocationProvider';
import {
  Satellite,
  Smartphone,
  Radio,
  Cpu,
  PlayCircle,
  Check,
  X,
  Compass,
} from 'lucide-react';

interface LocationProviderSelectorProps {
  onClose: () => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const LocationProviderSelector: React.FC<LocationProviderSelectorProps> = ({
  onClose,
  onAddToast,
}) => {
  const [activeType, setActiveType] = useState<LocationProviderType>(() =>
    locationManager.getActiveProviderType()
  );
  const providers = locationManager.getAvailableProviders();

  const handleSelect = async (type: LocationProviderType) => {
    await locationManager.setProvider(type);
    setActiveType(type);
    if (onAddToast) {
      const selected = providers.find((p) => p.id === type);
      onAddToast('Location Provider Changed', `Active: ${selected?.name || type}`, 'info');
    }
  };

  const getIcon = (id: LocationProviderType) => {
    switch (id) {
      case 'browser':
        return <Compass className="w-5 h-5 text-amber-400" />;
      case 'android':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case 'gnss_serial':
        return <Cpu className="w-5 h-5 text-purple-400" />;
      case 'mesh_triangulation':
        return <Radio className="w-5 h-5 text-sky-400" />;
      case 'replay':
        return <PlayCircle className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-stone-900 border-t border-stone-800 rounded-t-2xl shadow-2xl p-4 sm:p-6 max-h-[85vh] flex flex-col max-w-2xl mx-auto text-stone-100">
      <div className="flex items-center justify-between pb-3 border-b border-stone-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-stone-800 text-stone-300">
            <Satellite className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-100">Physical Device Location Mode</h2>
            <p className="text-xs text-stone-400">
              Select active GNSS/sensor backend (Phone, Laptop, Raspberry Pi, ESP32, Replay)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2.5 mt-4 flex-1 overflow-y-auto pr-1">
        {providers.map((p) => {
          const isSelected = p.id === activeType;
          return (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition ${
                isSelected
                  ? 'bg-amber-950/40 border-amber-500/60 text-stone-100 shadow-md'
                  : 'bg-stone-950/60 border-stone-800/80 hover:bg-stone-800/80 text-stone-300'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-stone-900 border border-stone-800 mt-0.5">
                  {getIcon(p.id)}
                </div>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {p.name}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 uppercase font-mono">
                      {p.sourceType}
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">{p.description}</div>
                </div>
              </div>

              {isSelected && (
                <div className="p-1 rounded-full bg-amber-500 text-stone-950 ml-2">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
