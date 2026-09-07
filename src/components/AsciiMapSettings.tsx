import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AsciiGridCell,
  exportAsciiToTxt,
  exportAsciiToAnsi,
  renderForSerial,
  downloadString,
} from '../utils/asciiExport';
import {
  X,
  Sliders,
  FileText,
  Terminal,
  Cpu,
  Copy,
  Check,
  ChevronDown,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';

export type AsciiTheme = 'phosphor' | 'amber' | 'paper' | 'night';

export interface AsciiMapSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AsciiTheme;
  onThemeChange: (theme: AsciiTheme) => void;
  columns: number;
  onColumnsChange: (cols: number) => void;
  rows: number;
  onRowsChange: (rows: number) => void;
  gridScale: number; // meters per cell (5m - 100m)
  onGridScaleChange: (scale: number) => void;
  glyphSet: 'unicode' | 'ascii';
  onGlyphSetChange: (glyphSet: 'unicode' | 'ascii') => void;
  gridBuffer: (string | AsciiGridCell)[][];
}

export const AsciiMapSettings: React.FC<AsciiMapSettingsProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  columns,
  onColumnsChange,
  rows,
  onRowsChange,
  gridScale,
  onGridScaleChange,
  glyphSet,
  onGlyphSetChange,
  gridBuffer,
}) => {
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'txt' | 'ansi' | 'serial'>('ansi');

  const handleCopyClipboard = () => {
    let content = '';
    if (exportFormat === 'ansi') {
      content = exportAsciiToAnsi(gridBuffer, theme, glyphSet === 'ascii');
    } else if (exportFormat === 'serial') {
      content = renderForSerial(gridBuffer);
    } else {
      content = exportAsciiToTxt(gridBuffer, glyphSet === 'ascii');
    }
    navigator.clipboard.writeText(content);
    setCopiedStatus('Copied to clipboard!');
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  const handleTriggerExport = (format: 'txt' | 'ansi' | 'serial') => {
    if (format === 'ansi') {
      const content = exportAsciiToAnsi(gridBuffer, theme, glyphSet === 'ascii');
      downloadString(content, 'hoimu_map.ansi');
    } else if (format === 'serial') {
      const content = renderForSerial(gridBuffer);
      downloadString(content, 'hoimu_map_serial.txt');
    } else {
      const content = exportAsciiToTxt(gridBuffer, glyphSet === 'ascii');
      downloadString(content, 'hoimu_map_viewport.txt');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs font-mono select-none">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Sliding Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative z-10 w-full max-w-md h-full bg-[#0a0d0b] border-l border-[#33ff00]/30 text-[#33ff00] p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#33ff00]/30 pb-4">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-[#33ff00]" />
                  <div>
                    <h2 className="font-bold text-base tracking-wider uppercase text-white">
                      Terminal Settings
                    </h2>
                    <p className="text-[11px] text-[#33ff00]/70">
                      Configure themes, grid bounds & hardware export
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-[#33ff00]/50 hover:bg-[#33ff00]/10 text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. Theme Radio Buttons */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-white flex items-center justify-between tracking-wide">
                  <span>DISPLAY THEME</span>
                  <span className="text-[10px] text-[#33ff00]/80 uppercase">{theme}</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {/* Phosphor */}
                  <label
                    onClick={() => onThemeChange('phosphor')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      theme === 'phosphor'
                        ? 'bg-[#33ff00]/15 border-[#33ff00] text-[#33ff00] font-bold shadow-xs'
                        : 'bg-black/50 border-white/10 text-white/70 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="theme"
                        checked={theme === 'phosphor'}
                        onChange={() => onThemeChange('phosphor')}
                        className="accent-[#33ff00] cursor-pointer"
                      />
                      <span>Phosphor</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#33ff00] shadow-[0_0_6px_#33ff00]" />
                  </label>

                  {/* Amber */}
                  <label
                    onClick={() => onThemeChange('amber')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      theme === 'amber'
                        ? 'bg-[#ffb000]/15 border-[#ffb000] text-[#ffb000] font-bold shadow-xs'
                        : 'bg-black/50 border-white/10 text-white/70 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="theme"
                        checked={theme === 'amber'}
                        onChange={() => onThemeChange('amber')}
                        className="accent-[#ffb000] cursor-pointer"
                      />
                      <span>Amber</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffb000]" />
                  </label>

                  {/* Paper (E-Ink) */}
                  <label
                    onClick={() => onThemeChange('paper')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      theme === 'paper'
                        ? 'bg-white border-white text-black font-black shadow-xs'
                        : 'bg-black/50 border-white/10 text-white/70 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="theme"
                        checked={theme === 'paper'}
                        onChange={() => onThemeChange('paper')}
                        className="accent-black cursor-pointer"
                      />
                      <span>Paper</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-white border border-black" />
                  </label>

                  {/* Night */}
                  <label
                    onClick={() => onThemeChange('night')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      theme === 'night'
                        ? 'bg-[#ff3333]/15 border-[#ff3333] text-[#ff3333] font-bold shadow-xs'
                        : 'bg-black/50 border-white/10 text-white/70 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="theme"
                        checked={theme === 'night'}
                        onChange={() => onThemeChange('night')}
                        className="accent-[#ff3333] cursor-pointer"
                      />
                      <span>Night</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff3333]" />
                  </label>
                </div>
              </div>

              {/* 2. Grid Size Slider (40x20 to 120x60) */}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white tracking-wide">GRID DIMENSIONS</span>
                  <span className="text-[#33ff00] font-bold">{columns} × {rows}</span>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] text-white/70">
                    <span>Columns (Width)</span>
                    <span className="text-white font-mono">{columns} cols</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={120}
                    step={2}
                    value={columns}
                    onChange={(e) => onColumnsChange(Number(e.target.value))}
                    className="w-full accent-[#33ff00] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-white/40">
                    <span>40</span>
                    <span>80</span>
                    <span>120</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between text-[11px] text-white/70">
                    <span>Rows (Height)</span>
                    <span className="text-white font-mono">{rows} rows</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={60}
                    step={2}
                    value={rows}
                    onChange={(e) => onRowsChange(Number(e.target.value))}
                    className="w-full accent-[#33ff00] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-white/40">
                    <span>20</span>
                    <span>40</span>
                    <span>60</span>
                  </div>
                </div>
              </div>

              {/* 3. Meters-per-cell Slider (5m to 100m) */}
              <div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white tracking-wide">METERS PER CELL</span>
                  <span className="text-[#33ff00] font-bold">{gridScale}m / cell</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={gridScale}
                  onChange={(e) => onGridScaleChange(Number(e.target.value))}
                  className="w-full accent-[#33ff00] cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-white/40">
                  <span>5m (Detailed)</span>
                  <span>50m</span>
                  <span>100m (Bioregional)</span>
                </div>
              </div>

              {/* 4. Glyph Set Toggle */}
              <div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
                <label className="text-xs font-bold text-white tracking-wide">GLYPH SET</label>
                <div className="grid grid-cols-2 gap-2 bg-black/60 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => onGlyphSetChange('unicode')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      glyphSet === 'unicode'
                        ? 'bg-[#33ff00] text-black shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>Unicode</span>
                    <span className="text-[10px] opacity-80">(♣ □ ▲ ≈ ☉ ⚡)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onGlyphSetChange('ascii')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                      glyphSet === 'ascii'
                        ? 'bg-[#33ff00] text-black shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>ASCII Only</span>
                    <span className="text-[10px] opacity-80">(+ # ^ ~ O E)</span>
                  </button>
                </div>
              </div>

              {/* 5. Export Dropdown & Utility */}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#33ff00]" />
                  <label className="text-xs font-bold text-white tracking-wide">EXPORT UTILITIES</label>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/70 min-w-20">Format:</span>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as 'txt' | 'ansi' | 'serial')}
                      className="flex-1 bg-black/80 border border-white/20 text-white rounded-lg p-2 text-xs focus:border-[#33ff00] outline-hidden cursor-pointer"
                    >
                      <option value="txt">Plain Text (.txt)</option>
                      <option value="ansi">ANSI Colors (.ansi for terminal)</option>
                      <option value="serial">Serial Safe (.txt no colors, max 80 char)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleTriggerExport(exportFormat)}
                      className="py-2.5 px-3 rounded-xl border border-[#33ff00]/40 bg-[#33ff00]/10 hover:bg-[#33ff00]/20 text-[#33ff00] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Download File</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyClipboard}
                      className="py-2.5 px-3 rounded-xl border border-white/20 bg-black/50 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      {copiedStatus ? (
                        <>
                          <Check className="w-4 h-4 text-[#33ff00]" />
                          <span className="text-[#33ff00]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-white/80" />
                          <span>Copy View</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-white/10 pt-4 mt-6 flex flex-col gap-2">
              <p className="text-[10px] text-white/50 text-center">
                Press <span className="text-[#33ff00] font-bold">'T'</span> to cycle themes • Press <span className="text-[#33ff00] font-bold">'E'</span> to copy ASCII
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#33ff00] text-black font-black text-xs uppercase tracking-wider hover:bg-[#33ff00]/90 transition-all cursor-pointer shadow-md"
              >
                Save & Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
