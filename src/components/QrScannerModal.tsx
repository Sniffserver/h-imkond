import React, { useState, useRef } from 'react';
import { X, QrCode, Camera, Sparkles, Upload, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ResourceItem } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportResource: (resource: any) => void;
  availablePeerResources: ResourceItem[];
  isNightMode?: boolean;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onImportResource,
  availablePeerResources,
  isNightMode = false,
}) => {
  const [pasteValue, setPasteValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<any | null>(null);
  const [isSimulatingCamera, setIsSimulatingCamera] = useState(true);

  if (!isOpen) return null;

  const handleProcessPayload = (rawPayload: string) => {
    try {
      setErrorMessage('');
      const cleanString = rawPayload.trim();
      if (!cleanString) return;

      const parsed = JSON.parse(cleanString);
      if (parsed.protocol === 'hoimu-p2p' && parsed.type === 'resource' && parsed.data) {
        setSuccessData(parsed.data);
      } else if (parsed.id && parsed.title && parsed.category) {
        // Direct object fallback
        setSuccessData(parsed);
      } else {
        setErrorMessage('Invalid QR payload format. Must be a valid HÕIMU P2P resource packet.');
      }
    } catch (e) {
      setErrorMessage('Failed to parse QR JSON code. Please check that the data is correct.');
    }
  };

  const handleImportClick = () => {
    if (successData) {
      onImportResource(successData);
      setPasteValue('');
      setSuccessData(null);
      onClose();
    }
  };

  const handleSimulatePeerClick = (res: ResourceItem) => {
    const mockPayload = {
      protocol: 'hoimu-p2p',
      type: 'resource',
      data: {
        ...res,
        id: `res-synced-${res.id}-${Date.now().toString().slice(-4)}`,
        distanceKm: Math.round((res.distanceKm + 0.2) * 10) / 10,
      }
    };
    setPasteValue(JSON.stringify(mockPayload, null, 2));
    handleProcessPayload(JSON.stringify(mockPayload));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="qr-scanner-modal"
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 duration-200 ${
          isNightMode
            ? 'bg-[#1E2C1B] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/35 text-[#203A2A]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#87A878]/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2A9D8F]/10 text-[#2A9D8F]">
              <QrCode className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg">
                P2P QR Code Synchronization
              </h3>
              <p className="text-[10px] text-[#588157]">
                Local-first zero-infrastructure data transfer for resource sharing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5 text-[#637062]" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-black/5 dark:bg-black/20 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setIsSimulatingCamera(true);
              setSuccessData(null);
              setErrorMessage('');
            }}
            className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
              isSimulatingCamera
                ? 'bg-white dark:bg-[#2A3B26] shadow-xs text-[#203A2A] dark:text-white'
                : 'text-[#637062] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
            }`}
          >
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSimulatingCamera(false);
              setSuccessData(null);
              setErrorMessage('');
            }}
            className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
              !isSimulatingCamera
                ? 'bg-white dark:bg-[#2A3B26] shadow-xs text-[#203A2A] dark:text-white'
                : 'text-[#637062] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]'
            }`}
          >
            Manual Packet Entry
          </button>
        </div>

        {isSimulatingCamera ? (
          /* Simulated Terminal Camera View */
          <div className="space-y-4">
            <div className="relative aspect-video rounded-2xl bg-black/90 border border-emerald-500/20 overflow-hidden flex flex-col items-center justify-center text-center p-4">
              {/* Scan Reticle */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-500/40 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-emerald-500 rounded-lg relative">
                  {/* Scan Laser effect */}
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_#10B981] animate-[bounce_3s_infinite]" />
                </div>
              </div>

              <Camera className="w-8 h-8 text-emerald-500/60 mb-2 animate-pulse" />
              <span className="text-[11px] font-mono text-emerald-400 tracking-widest uppercase">
                Terminal Scanner Active
              </span>
              <span className="text-[10px] text-zinc-500 mt-1 max-w-[260px]">
                iFrame sandbox loaded. Scanning BLE P2P QR beacons.
              </span>
            </div>

            {/* Simulated QR Beacons Selector */}
            <div className="space-y-2">
              <span className="text-xs font-bold block">
                Detected Nearby Peer QR Beacons:
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {availablePeerResources.length === 0 ? (
                  <p className="text-[11px] text-[#637062] italic py-1">
                    No active peer QR beacons detected within radio range.
                  </p>
                ) : (
                  availablePeerResources.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => handleSimulatePeerClick(res)}
                      className="w-full text-left p-2.5 rounded-xl border border-[#87A878]/30 bg-white dark:bg-[#2A3B26]/30 hover:border-[#87A878] hover:bg-[#F0F5EE] dark:hover:bg-[#2A3B26]/50 flex items-center justify-between text-xs transition-all cursor-pointer"
                    >
                      <div>
                        <span className="font-bold block text-[#203A2A] dark:text-[#F0F5EE]">
                          {res.title}
                        </span>
                        <span className="text-[10px] text-[#637062]">
                          Offered by @{res.ownerCallsign} ({res.category})
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#2A9D8F] bg-[#2A9D8F]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 animate-pulse" />
                        Scan
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Manual JSON Packet Import */
          <div className="space-y-2">
            <span className="text-xs font-bold block flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#588157]" />
              Paste Sync QR Packet Data:
            </span>
            <textarea
              value={pasteValue}
              onChange={(e) => {
                setPasteValue(e.target.value);
                handleProcessPayload(e.target.value);
              }}
              placeholder='{"protocol": "hoimu-p2p", "type": "resource", "data": {...}}'
              rows={4}
              className="w-full p-2.5 font-mono text-[10px] border rounded-xl focus:ring-2 focus:ring-[#87A878] resize-none bg-white dark:bg-black/10 text-current border-current/15"
            />
            <p className="text-[10px] text-[#637062] leading-snug">
              To test real sync, copy the code generated from any resource detail modal and paste it above!
            </p>
          </div>
        )}

        {/* Display Error Message */}
        {errorMessage && (
          <div className="p-3 bg-[#E76F51]/10 text-[#9A3822] rounded-xl border border-[#E76F51]/30 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Display Successfully Decoded Resource Preview */}
        {successData && (
          <div className="p-4 bg-[#F0F5EE] dark:bg-[#223120] rounded-2xl border-2 border-[#2A9D8F] space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2A9D8F]/20 pb-2">
              <span className="text-xs font-bold text-[#2A9D8F] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 animate-bounce" />
                QR Package Synced Successfully!
              </span>
              <span className="text-[10px] font-mono bg-[#2A9D8F]/10 text-[#2A9D8F] px-2 py-0.5 rounded-full font-bold">
                {successData.category}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="font-display font-black text-[#203A2A] dark:text-white text-sm">
                {successData.title}
              </h4>
              <p className="text-xs text-[#637062] line-clamp-2">
                {successData.description}
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] font-medium text-[#588157]">
                <span>Offered by: @{successData.ownerCallsign}</span>
                <span>Distance: {successData.distanceKm || 0.5} km</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleImportClick}
              className="w-full py-2 bg-[#2A9D8F] hover:bg-[#218175] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Resource Into Terminal Cache
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
