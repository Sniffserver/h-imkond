import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Battery,
  Zap,
  Moon,
  GraduationCap,
  BookOpen,
  Siren,
  Eye,
  EyeOff,
  Globe,
  Search,
  Keyboard,
  Compass,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { BatteryManagerStatus } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { SosButton } from './SosButton';
import { PiBridgeStatusBadge } from './PiBridgeStatusBadge';
import { ThemeMode, FieldDisplayMode } from '../hooks/useAppThemeModes';

interface HoimuAppHeaderProps {
  batteryStatus: BatteryManagerStatus;
  onToggleSolarAware: () => void;
  peerCount: number;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  themeMode?: ThemeMode;
  fieldDisplayMode?: FieldDisplayMode;
  onSetThemeMode?: (mode: ThemeMode) => void;
  onSetFieldDisplayMode?: (mode: FieldDisplayMode) => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  isCrisisMode?: boolean;
  onToggleCrisisMode?: () => void;
  onOpenToolsModal?: () => void;
  onOpenQuickGuide?: () => void;
  onOpenCalendar?: () => void;
  onOpenSkills?: () => void;
  onOpenTrust?: () => void;
  onOpenManual?: () => void;
  onOpenLandingPage?: () => void;
  onOpenSecurityKeys?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenPiBridge?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
  userCallsign?: string;
  userLat?: number;
  userLng?: number;
  onSosTriggered?: (reason: string) => void;
}

export const HoimuAppHeader: React.FC<HoimuAppHeaderProps> = ({
  batteryStatus,
  onToggleSolarAware,
  peerCount,
  isNightMode = false,
  onToggleNightMode,
  themeMode = 'auto',
  fieldDisplayMode = 'normal',
  onSetThemeMode,
  onSetFieldDisplayMode,
  isFocusMode = false,
  onToggleFocusMode,
  isCrisisMode = false,
  onToggleCrisisMode,
  onOpenToolsModal,
  onOpenQuickGuide,
  onOpenCalendar,
  onOpenSkills,
  onOpenTrust,
  onOpenManual,
  onOpenLandingPage,
  onOpenSecurityKeys,
  onOpenDiagnostics,
  onOpenPiBridge,
  onOpenCommandPalette,
  onOpenShortcuts,
  userCallsign,
  userLat,
  userLng,
  onSosTriggered,
}) => {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTheme = (mode: ThemeMode) => {
    if (onSetFieldDisplayMode) onSetFieldDisplayMode('normal');
    if (onSetThemeMode) onSetThemeMode(mode);
    setIsThemeMenuOpen(false);
  };

  const handleSelectRed = () => {
    if (onSetFieldDisplayMode) onSetFieldDisplayMode('red');
    setIsThemeMenuOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-md border-b shadow-xs transition-colors duration-200 ${
        fieldDisplayMode === 'red'
          ? 'bg-[#150506]/95 border-[#451014]'
          : isNightMode
          ? 'bg-[#182315]/95 border-[#2A3B26]'
          : 'bg-[#FAF6EE]/92 border-[#87A878]/30'
      }`}
    >
      {/* Top Solarpunk Telemetry Banner */}
      <div
        className={`px-4 py-1.5 text-[11px] font-mono flex items-center justify-between border-b transition-colors ${
          fieldDisplayMode === 'red'
            ? 'bg-[#0D0303] text-[#FF8A93] border-[#451014]'
            : isNightMode
            ? 'bg-[#121A10] text-[#D8E6D5] border-[#2A3B26]'
            : 'bg-[#203A2A] text-[#F0F5EE] border-[#87A878]/20'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#87A878] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#87A878]" />
            </span>
            <span className="text-[#E9C46A] font-semibold">MESH ACTIVE:</span>
            <span>{peerCount} Peers (Zero-Cloud)</span>
          </span>
          <span className="hidden md:inline text-white/30">•</span>
          <PiBridgeStatusBadge isNightMode={isNightMode} onClick={onOpenPiBridge} />
        </div>

        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1 text-[#E9C46A]">
            <Zap className="w-3 h-3" />
            <span>{batteryStatus.solarHarvestRateW}W Harvest</span>
          </div>

          <div className="flex items-center gap-1 text-[#F0F5EE]">
            <Battery className="w-3.5 h-3.5 text-[#87A878]" />
            <span>{batteryStatus.batteryLevelPercent}%</span>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & Tagline */}
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={onOpenLandingPage || onOpenManual}
          title="Open HÕIMU Solarpunk Landing Page & Overview"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#588157] via-[#87A878] to-[#E9C46A] p-0.5 shadow-md flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                fieldDisplayMode === 'red' ? 'bg-[#1B0A0C]' : isNightMode ? 'bg-[#182315]' : 'bg-[#FAF6EE]'
              }`}
            >
              <span
                className={`font-display font-black text-lg tracking-tighter ${
                  fieldDisplayMode === 'red' ? 'text-[#FF4D5A]' : isNightMode ? 'text-[#E9C46A]' : 'text-[#203A2A]'
                }`}
              >
                Hõ
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1
                className={`font-display font-bold text-lg tracking-tight ${
                  fieldDisplayMode === 'red' ? 'text-[#FF8A93]' : isNightMode ? 'text-[#F0F5EE]' : 'text-[#203A2A]'
                }`}
              >
                HÕIMU
              </h1>
              <span
                className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                  fieldDisplayMode === 'red'
                    ? 'bg-[#3A0F13] text-[#FF4D5A] border-[#601A20]'
                    : isNightMode
                    ? 'bg-[#2A3B26] text-[#E9C46A] border-[#364E30]'
                    : 'bg-[#87A878]/15 text-[#588157] border-[#87A878]/30'
                }`}
              >
                Mesh
              </span>
            </div>
          </div>
        </div>

        {/* Feature Quick Launch Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          {onOpenCommandPalette && (
            <button
              id="header-search-btn"
              type="button"
              onClick={onOpenCommandPalette}
              className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                isNightMode
                  ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878] hover:text-[#F0F5EE]'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878] hover:text-[#203A2A]'
              }`}
              title="Search Mesh, Resources, or Execute Command (Cmd+K / Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-[#588157] dark:text-[#E9C46A]" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-[9px] font-mono opacity-60 bg-black/5 dark:bg-white/10 px-1 py-0.2 rounded">⌘K</kbd>
            </button>
          )}

          {onOpenToolsModal && (
            <button
              id="header-community-tools-btn"
              type="button"
              onClick={onOpenToolsModal}
              className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 ${
                isNightMode
                  ? 'bg-[#1A2617] text-[#E9C46A] border-[#364E30] hover:bg-[#2A3B26]'
                  : 'bg-[#588157]/15 text-[#203A2A] border-[#588157]/35 hover:bg-[#588157]/25'
              }`}
              title="Open Community Hub: Calendar, Skills, Trust, DAO & Field Utilities"
            >
              <Globe className="w-3.5 h-3.5 text-[#588157] dark:text-[#E9C46A]" />
              <span>Tools & Hub</span>
            </button>
          )}

          {onOpenSkills && (
            <button
              id="header-skills-btn"
              type="button"
              onClick={onOpenSkills}
              className={`px-2.5 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                isNightMode
                  ? 'bg-[#121A10] text-[#E9C46A] border-[#2A3B26] hover:bg-[#1A2617]'
                  : 'bg-white text-[#8C6207] border-[#E9C46A]/40 hover:bg-[#E9C46A]/15'
              }`}
              title="Community Skills, Workshops & Verified Trades"
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Skills</span>
            </button>
          )}

          {onOpenQuickGuide && (
            <button
              id="header-guide-btn"
              type="button"
              onClick={onOpenQuickGuide}
              className={`px-2.5 py-1.5 rounded-xl border font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                isNightMode
                  ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26] hover:text-[#F0F5EE]'
                  : 'bg-white text-[#637062] border-[#87A878]/30 hover:text-[#203A2A]'
              }`}
              title="Open Quick Guide & Overview"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#F4A261]" />
              <span className="hidden md:inline">Guide</span>
            </button>
          )}

          {isCrisisMode && onToggleCrisisMode && (
            <button
              type="button"
              onClick={onToggleCrisisMode}
              className="px-2.5 py-1.5 rounded-xl border font-bold flex items-center gap-1 transition-all cursor-pointer bg-red-600 text-white border-red-500 animate-pulse shrink-0"
              title="Crisis Mode is Active. Click to Manage Crisis Protocol."
            >
              <Siren className="w-3.5 h-3.5" />
              <span>Crisis Active</span>
            </button>
          )}
        </div>

        {/* Action Toggles: SOS Emergency Button, Focus Mode, Night Mode & Solar-Aware */}
        <div className="flex items-center gap-1.5">
          {/* Always Visible Emergency SOS Button */}
          <SosButton
            userCallsign={userCallsign}
            userLat={userLat}
            userLng={userLng}
            onSosTriggered={onSosTriggered}
            isNightMode={isNightMode}
          />

          <PWAInstallButton />

          {/* ADHD Focus Mode Toggle Button */}
          {onToggleFocusMode && (
            <button
              id="focus-mode-toggle-btn"
              type="button"
              onClick={onToggleFocusMode}
              className={`p-2 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
                isFocusMode
                  ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] font-bold shadow-xs'
                  : isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]'
                  : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
              title={isFocusMode ? 'Disable Focus Mode' : 'Enable ADHD Focus Mode'}
            >
              {isFocusMode ? (
                <EyeOff className="w-4 h-4 text-[#203A2A]" />
              ) : (
                <Eye className="w-4 h-4 text-[#2A9D8F]" />
              )}
              <span className="hidden xl:inline text-[11px]">
                {isFocusMode ? 'Fookus: SEES' : 'Fookus'}
              </span>
            </button>
          )}
          
          {/* Keyboard Shortcuts Trigger */}
          {onOpenShortcuts && (
            <button
              id="shortcuts-toggle-btn"
              type="button"
              onClick={onOpenShortcuts}
              className={`p-2 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isNightMode
                  ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878] hover:text-[#FAF6EE]'
                  : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878] hover:text-[#203A2A]'
              }`}
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Theme Selector Popover Dropdown (☀ Päev, 🌙 Öö, 🔴 Puna-Öö, AUTO) */}
          <div className="relative" ref={themeMenuRef}>
            <button
              id="night-mode-toggle-btn"
              type="button"
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              className={`px-2.5 py-2 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                fieldDisplayMode === 'red'
                  ? 'bg-[#451014] text-[#FF8A93] border-[#701A22]'
                  : isNightMode
                  ? 'bg-[#2A3B26] text-[#E9C46A] border-[#364E30] hover:bg-[#364E30]'
                  : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
              }`}
              title="Teemarežiim (Päev / Öö / Puna-Öö / Päikese-Auto)"
            >
              {fieldDisplayMode === 'red' ? (
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse inline-block" />
              ) : themeMode === 'auto' ? (
                <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
              ) : isNightMode ? (
                <Moon className="w-3.5 h-3.5 text-[#E9C46A]" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-[#588157]" />
              )}
              <span className="hidden md:inline font-mono text-[10px] font-bold">
                {fieldDisplayMode === 'red' ? 'PUNA' : themeMode === 'auto' ? 'AUTO' : isNightMode ? 'ÖÖ' : 'PÄEV'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 dark:border-[#364E30] shadow-xl p-2 z-50 flex flex-col gap-1 text-xs font-semibold">
                <div className="px-2 py-1 text-[10px] font-mono text-[#637062] dark:text-[#8E9A71] uppercase border-b border-black/5 dark:border-white/5">
                  Vali teemarežiim:
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectTheme('auto')}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                    themeMode === 'auto' && fieldDisplayMode !== 'red'
                      ? 'bg-[#588157]/15 text-[#588157] dark:text-[#E9C46A] font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#203A2A] dark:text-[#D8E6D5]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
                    <span>AUTO · Päikese järgi</span>
                  </span>
                  {themeMode === 'auto' && fieldDisplayMode !== 'red' && <span className="text-[10px]">✓</span>}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTheme('day')}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                    themeMode === 'day' && fieldDisplayMode !== 'red'
                      ? 'bg-[#588157]/15 text-[#588157] font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#203A2A] dark:text-[#D8E6D5]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-[#588157]" />
                    <span>☀ Päev (Topo paber)</span>
                  </span>
                  {themeMode === 'day' && fieldDisplayMode !== 'red' && <span className="text-[10px]">✓</span>}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTheme('night')}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                    themeMode === 'night' && fieldDisplayMode !== 'red'
                      ? 'bg-[#2A3B26] text-[#E9C46A] font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#203A2A] dark:text-[#D8E6D5]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-[#E9C46A]" />
                    <span>🌙 Öö (Välimapp)</span>
                  </span>
                  {themeMode === 'night' && fieldDisplayMode !== 'red' && <span className="text-[10px]">✓</span>}
                </button>

                <button
                  type="button"
                  onClick={handleSelectRed}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                    fieldDisplayMode === 'red'
                      ? 'bg-[#451014] text-[#FF8A93] font-bold'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#203A2A] dark:text-[#D8E6D5]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-500" />
                    <span>🔴 Puna-Öö (Stealth)</span>
                  </span>
                  {fieldDisplayMode === 'red' && <span className="text-[10px]">✓</span>}
                </button>
              </div>
            )}
          </div>

          {/* Solar-Aware Battery Mode Toggle Button */}
          <button
            id="solar-aware-toggle-btn"
            type="button"
            onClick={onToggleSolarAware}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer ${
              batteryStatus.isSolarAwareActive
                ? isNightMode
                  ? 'bg-[#E9C46A]/20 text-[#E9C46A] border-[#E9C46A] shadow-xs'
                  : 'bg-[#E9C46A]/20 text-[#8C6207] border-[#E9C46A] shadow-xs'
                : isNightMode
                ? 'bg-[#182315] text-[#A8BDA5] border-[#2A3B26] hover:border-[#87A878]'
                : 'bg-white/80 text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
            }`}
            title="Toggle Solar-Aware Mode (BLE only, 15-min sync cadence, slower radar sweep)"
          >
            <Sun
              className={`w-3.5 h-3.5 text-[#F4A261] transition-transform ${
                batteryStatus.isSolarAwareActive ? 'animate-pulse scale-110' : ''
              }`}
            />
            <span className="hidden lg:inline">
              {batteryStatus.isSolarAwareActive ? 'Solar: ON' : 'Solar: OFF'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
