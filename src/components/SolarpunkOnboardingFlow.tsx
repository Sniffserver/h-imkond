import React, { useState } from 'react';
import { UserProfile, GeoPoint } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { stringResource, R } from '../utils/stringResource';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  Column,
  Row,
  Surface,
  Text,
  OutlinedTextField,
  Button,
  OutlinedButton,
  FilterChip,
  Switch,
  HorizontalDivider,
} from './compose/ComposeUI';
import {
  Radio,
  ShieldCheck,
  Zap,
  Users,
  WifiOff,
  Sparkles,
  Compass,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Dices,
  Lock,
  Plus,
  Signal,
  MapPin,
  Map,
  MessageSquare,
  Repeat,
  Layers,
  Navigation,
  Footprints,
  Info,
} from 'lucide-react';

export interface SolarpunkOnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (updatedProfile: Partial<UserProfile>, visibilityPrefs?: MeshVisibilityPreferences) => void;
  currentUser?: UserProfile;
  isNightMode?: boolean;
}

export interface MeshVisibilityPreferences {
  visibilityMode: 'public' | 'stealth' | 'listen_only';
  bleEnabled: boolean;
  wifiDirectEnabled: boolean;
  locationPrecision: 'obfuscated' | 'exact' | 'none';
  beaconIntervalSeconds: number;
  sosRelayEnabled: boolean;
}

const DEFAULT_CALLSIGNS = [
  'Kullerkupp',
  'Männikäbi',
  'Päikesesilm',
  'Rändur-42',
  'Supilinna-Aednik',
  'Udu-Kaja',
  'Tammetõru',
  'Nõmme-Kuller',
  'Allika-Sõber',
  'Tuulekell',
];

const PRESET_SKILLS = [
  { key: 'skill_solar_energy', label: stringResource(R.string.skill_solar_energy) },
  { key: 'skill_permaculture', label: stringResource(R.string.skill_permaculture) },
  { key: 'skill_radio_comms', label: stringResource(R.string.skill_radio_comms) },
  { key: 'skill_first_aid', label: stringResource(R.string.skill_first_aid) },
  { key: 'skill_bicycle_repair', label: stringResource(R.string.skill_bicycle_repair) },
  { key: 'skill_foraging', label: stringResource(R.string.skill_foraging) },
  { key: 'skill_woodworking', label: stringResource(R.string.skill_woodworking) },
  { key: 'skill_seed_saving', label: stringResource(R.string.skill_seed_saving) },
  { key: 'skill_fermentation', label: stringResource(R.string.skill_fermentation) },
  { key: 'skill_water_purification', label: stringResource(R.string.skill_water_purification) },
];

export const SolarpunkOnboardingFlow: React.FC<SolarpunkOnboardingFlowProps> = ({
  isOpen,
  onClose,
  onComplete,
  currentUser,
  isNightMode = false,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Profile Creation State
  const [callsign, setCallsign] = useState(currentUser?.callsign || 'Kullerkupp');
  const [bio, setBio] = useState(
    currentUser?.bio || 'Permakultuuri kasvataja ja kohalik päikeseenergia katsetaja.'
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    currentUser?.skills?.length
      ? currentUser.skills
      : [stringResource(R.string.skill_solar_energy), stringResource(R.string.skill_permaculture)]
  );
  const [avatarSeed, setAvatarSeed] = useState(currentUser?.avatarSeed || 'solarpunk-node-1');
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [isAddingCustomSkill, setIsAddingCustomSkill] = useState(false);
  const [callsignError, setCallsignError] = useState('');

  // Mesh Visibility Preferences State
  const [visibilityPrefs, setVisibilityPrefs] = useState<MeshVisibilityPreferences>({
    visibilityMode: 'public',
    bleEnabled: true,
    wifiDirectEnabled: true,
    locationPrecision: 'obfuscated',
    beaconIntervalSeconds: 30,
    sosRelayEnabled: true,
  });

  const modalRef = useFocusTrap({ isOpen, onClose, modalName: 'Solarpunk Onboarding Flow' });

  if (!isOpen) return null;

  const handleRandomizeCallsign = () => {
    const randomIndex = Math.floor(Math.random() * DEFAULT_CALLSIGNS.length);
    const chosen = DEFAULT_CALLSIGNS[randomIndex];
    const newSeed = `${chosen.toLowerCase()}-${Date.now() % 1000}`;
    setCallsign(chosen);
    setAvatarSeed(newSeed);
    setCallsignError('');
  };

  const handleToggleSkill = (skillName: string) => {
    if (selectedSkills.includes(skillName)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skillName));
    } else {
      setSelectedSkills([...selectedSkills, skillName]);
    }
  };

  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills([...selectedSkills, trimmed]);
      setCustomSkillInput('');
      setIsAddingCustomSkill(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 2) {
      if (callsign.trim().length < 3) {
        setCallsignError(stringResource(R.string.field_callsign_error));
        return;
      }
      setCallsignError('');
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    const updatedProfile: Partial<UserProfile> = {
      callsign: callsign.trim() || 'Hõimlane',
      bio: bio.trim(),
      skills: selectedSkills,
      avatarSeed: avatarSeed || callsign,
      meshVisible: visibilityPrefs.visibilityMode !== 'listen_only',
      isMeshVisible: visibilityPrefs.visibilityMode !== 'listen_only',
    };
    onComplete(updatedProfile, visibilityPrefs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-flow-title"
        id="solarpunk-onboarding-modal"
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#FAF6EE] dark:bg-[#152014] rounded-3xl border border-[#87A878]/35 shadow-2xl overflow-hidden transition-all duration-200"
      >
        {/* Top Header Bar */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#87A878]/25 bg-white/60 dark:bg-[#182315]/80">
          <Row verticalAlignment="center" gap={2}>
            <div className="p-1.5 rounded-xl bg-[#588157]/15 text-[#588157]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <Text id="onboarding-flow-title" style="titleMedium" className="tracking-tight">
                {stringResource(R.string.app_name)}
              </Text>
              <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878]">
                {stringResource(R.string.app_tagline)}
              </Text>
            </div>
          </Row>

          <Row verticalAlignment="center" gap={3}>
            {/* Step Indicator Progress */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((stepNum) => (
                <button
                  key={stepNum}
                  type="button"
                  onClick={() => {
                    if (stepNum < currentStep) setCurrentStep(stepNum);
                  }}
                  aria-label={`Mine sammu juurde ${stepNum}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stepNum === currentStep
                      ? 'w-6 bg-[#588157]'
                      : stepNum < currentStep
                      ? 'w-2 bg-[#588157]/60 cursor-pointer'
                      : 'w-2 bg-[#637062]/25 dark:bg-[#364E30]'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close onboarding modal"
              className="p-1 rounded-full text-[#637062] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </Row>
        </div>

        {/* Scrollable Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* ========================================================
              STEP 1: Welcome & Solarpunk Mesh Purpose
             ======================================================== */}
          {currentStep === 1 && (
            <Column gap={4} className="animate-in fade-in duration-200">
              <Row verticalAlignment="center" gap={2}>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                  {stringResource(R.string.onboarding_welcome_badge)}
                </span>
              </Row>

              <Column gap={1}>
                <Text style="headlineMedium" className="text-[#203A2A] dark:text-[#F0F5EE]">
                  {stringResource(R.string.onboarding_welcome_title)}
                </Text>
                <Text style="titleSmall" className="text-[#588157] dark:text-[#87A878]">
                  {stringResource(R.string.onboarding_welcome_subtitle)}
                </Text>
                <Text style="bodyMedium" className="text-[#637062] dark:text-[#A8BDA5] pt-1">
                  {stringResource(R.string.onboarding_welcome_desc)}
                </Text>
              </Column>

              <HorizontalDivider />

              <Text style="titleSmall" className="text-[#203A2A] dark:text-[#F0F5EE]">
                {stringResource(R.string.solarpunk_core_title)}
              </Text>

              {/* Three Solarpunk Concept Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Surface
                  shape="rounded-2xl"
                  className="p-3.5 bg-white/80 dark:bg-[#1E2B1C] border-[#87A878]/30 space-y-1.5"
                >
                  <div className="p-2 w-fit rounded-xl bg-[#588157]/15 text-[#588157]">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <Text style="titleSmall" className="text-xs">
                    {stringResource(R.string.solarpunk_concept_offline_title)}
                  </Text>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878]">
                    {stringResource(R.string.solarpunk_concept_offline_desc)}
                  </Text>
                </Surface>

                <Surface
                  shape="rounded-2xl"
                  className="p-3.5 bg-white/80 dark:bg-[#1E2B1C] border-[#87A878]/30 space-y-1.5"
                >
                  <div className="p-2 w-fit rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <Text style="titleSmall" className="text-xs">
                    {stringResource(R.string.solarpunk_concept_crypto_title)}
                  </Text>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878]">
                    {stringResource(R.string.solarpunk_concept_crypto_desc)}
                  </Text>
                </Surface>

                <Surface
                  shape="rounded-2xl"
                  className="p-3.5 bg-white/80 dark:bg-[#1E2B1C] border-[#87A878]/30 space-y-1.5"
                >
                  <div className="p-2 w-fit rounded-xl bg-[#E9C46A]/20 text-[#D4A338]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <Text style="titleSmall" className="text-xs">
                    {stringResource(R.string.solarpunk_concept_mutual_aid_title)}
                  </Text>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878]">
                    {stringResource(R.string.solarpunk_concept_mutual_aid_desc)}
                  </Text>
                </Surface>
              </div>
            </Column>
          )}

          {/* ========================================================
              STEP 2: Solarpunk Avatar & Profile Creation
             ======================================================== */}
          {currentStep === 2 && (
            <Column gap={4} className="animate-in fade-in duration-200">
              <Row verticalAlignment="center" gap={2}>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                  {stringResource(R.string.onboarding_profile_badge)}
                </span>
              </Row>

              <Column gap={1}>
                <Text style="headlineMedium" className="text-[#203A2A] dark:text-[#F0F5EE]">
                  {stringResource(R.string.onboarding_profile_title)}
                </Text>
                <Text style="titleSmall" className="text-[#588157] dark:text-[#87A878]">
                  {stringResource(R.string.onboarding_profile_subtitle)}
                </Text>
                <Text style="bodySmall" className="text-[#637062] dark:text-[#A8BDA5]">
                  {stringResource(R.string.onboarding_profile_desc)}
                </Text>
              </Column>

              <HorizontalDivider />

              {/* Avatar Preview & Callsign Input Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-4 flex flex-col items-center justify-center p-4 bg-white/70 dark:bg-[#1F2C1D] rounded-2xl border border-[#87A878]/30 text-center space-y-2">
                  <SolarpunkAvatarCanvas seed={avatarSeed || callsign} size={84} />
                  <div className="text-[12px] font-mono text-[#588157] font-bold">
                    @{callsign || 'Tundmatu'}
                  </div>
                  <Button
                    variant="outlined"
                    onClick={() => setAvatarSeed(`node-${Math.random().toString(36).substring(2, 7)}`)}
                    className="py-1 px-2.5 text-[11px] rounded-xl"
                    leadingIcon={<Dices className="w-3.5 h-3.5" />}
                  >
                    {stringResource(R.string.btn_dice_avatar)}
                  </Button>
                </div>

                <div className="sm:col-span-8 space-y-3">
                  <OutlinedTextField
                    id="input-callsign"
                    value={callsign}
                    onValueChange={(val) => {
                      setCallsign(val);
                      if (val.trim().length >= 3) setCallsignError('');
                    }}
                    label={stringResource(R.string.field_callsign_label)}
                    placeholder={stringResource(R.string.field_callsign_placeholder)}
                    supportingText={stringResource(R.string.field_callsign_helper)}
                    isError={!!callsignError}
                    errorMessage={callsignError}
                    leadingIcon={<Radio className="w-4 h-4" />}
                    trailingIcon={
                      <button
                        type="button"
                        onClick={handleRandomizeCallsign}
                        title={stringResource(R.string.field_callsign_random)}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                      >
                        <Dices className="w-4 h-4 text-[#588157]" />
                      </button>
                    }
                  />

                  <OutlinedTextField
                    id="input-bio"
                    multiline
                    rows={2}
                    value={bio}
                    onValueChange={setBio}
                    label={stringResource(R.string.field_bio_label)}
                    placeholder={stringResource(R.string.field_bio_placeholder)}
                    supportingText={stringResource(R.string.field_bio_helper)}
                  />
                </div>
              </div>

              {/* Skills Picker */}
              <Column gap={2}>
                <Row horizontalArrangement="space-between" verticalAlignment="center">
                  <Text style="labelLarge">
                    {stringResource(R.string.field_skills_label)}
                  </Text>
                  <span className="text-[11px] font-mono text-[#588157]">
                    {selectedSkills.length} valitud
                  </span>
                </Row>
                <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878]">
                  {stringResource(R.string.field_skills_helper)}
                </Text>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_SKILLS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill.label);
                    return (
                      <FilterChip
                        key={skill.key}
                        label={skill.label}
                        selected={isSelected}
                        onClick={() => handleToggleSkill(skill.label)}
                        leadingIcon={
                          isSelected ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-[#588157]" />
                          )
                        }
                      />
                    );
                  })}

                  {selectedSkills
                    .filter((s) => !PRESET_SKILLS.some((ps) => ps.label === s))
                    .map((custom) => (
                      <FilterChip
                        key={custom}
                        label={custom}
                        selected={true}
                        onClick={() => handleToggleSkill(custom)}
                        leadingIcon={<CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      />
                    ))}
                </div>

                {isAddingCustomSkill ? (
                  <Row gap={2} verticalAlignment="center" className="pt-2">
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      placeholder={stringResource(R.string.custom_skill_prompt)}
                      className="px-3 py-1.5 rounded-xl border border-[#87A878]/40 bg-white dark:bg-[#1E2B1C] text-xs outline-none focus:border-[#588157]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCustomSkill();
                      }}
                    />
                    <Button
                      variant="filled"
                      onClick={handleAddCustomSkill}
                      className="py-1 px-3 text-xs rounded-xl"
                    >
                      Lisa
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => setIsAddingCustomSkill(false)}
                      className="text-xs"
                    >
                      Tühista
                    </Button>
                  </Row>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomSkill(true)}
                    className="w-fit text-xs font-semibold text-[#588157] hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{stringResource(R.string.btn_add_custom_skill)}</span>
                  </button>
                )}
              </Column>
            </Column>
          )}

          {/* ========================================================
              STEP 3: Mesh Networking & Privacy Deep Dive
             ======================================================== */}
          {currentStep === 3 && (
            <Column gap={4} className="animate-in fade-in duration-200">
              <Row verticalAlignment="center" gap={2}>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                  {stringResource(R.string.onboarding_mesh_privacy_badge)}
                </span>
              </Row>

              <Column gap={1}>
                <Text style="headlineMedium" className="text-[#203A2A] dark:text-[#F0F5EE]">
                  {stringResource(R.string.onboarding_mesh_privacy_title)}
                </Text>
                <Text style="titleSmall" className="text-[#588157] dark:text-[#87A878]">
                  {stringResource(R.string.onboarding_mesh_privacy_subtitle)}
                </Text>
                <Text style="bodySmall" className="text-[#637062] dark:text-[#A8BDA5]">
                  {stringResource(R.string.onboarding_mesh_privacy_desc)}
                </Text>
              </Column>

              <HorizontalDivider />

              {/* Visual Mesh Diagram */}
              <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#1E2B1C] border border-[#87A878]/30 flex flex-col items-center justify-center text-center space-y-3">
                <div className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-md">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#588157]/20 flex items-center justify-center text-[#588157] shadow-sm">
                      <Radio className="w-6 h-6 animate-pulse" />
                    </div>
                    <span className="text-[10px] font-mono font-bold mt-1">Sinu Sõlm</span>
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[9px] font-mono text-[#588157] uppercase tracking-wider mb-1">BLE / LoRa Hop</span>
                    <div className="w-full h-1 bg-linear-to-r from-[#588157] via-[#2A9D8F] to-[#E9C46A] rounded-full relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#E9C46A] animate-ping" />
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 mt-1">Store & Forward</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#2A9D8F]/20 flex items-center justify-center text-[#2A9D8F] shadow-sm">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono font-bold mt-1">Naabersõlm</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 max-w-sm">
                  Paketid liiguvad seadmelt seadmele krüpteeritud ümbrikes. Sinu telefon salvestab ja edastab sõnumeid taustal ilma tsentraalsete tornideta.
                </p>
              </div>

              {/* 4 Architectural Concept Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Surface shape="rounded-2xl" className="p-4 bg-white/80 dark:bg-[#1E2B1C] space-y-2">
                  <Row verticalAlignment="center" gap={2}>
                    <div className="p-2 rounded-xl bg-[#588157]/15 text-[#588157]">
                      <Radio className="w-4 h-4" />
                    </div>
                    <Text style="titleSmall">
                      {stringResource(R.string.mesh_concept_p2p_title)}
                    </Text>
                  </Row>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878] leading-relaxed">
                    {stringResource(R.string.mesh_concept_p2p_desc)}
                  </Text>
                </Surface>

                <Surface shape="rounded-2xl" className="p-4 bg-white/80 dark:bg-[#1E2B1C] space-y-2">
                  <Row verticalAlignment="center" gap={2}>
                    <div className="p-2 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <Text style="titleSmall">
                      {stringResource(R.string.mesh_concept_zero_cloud_title)}
                    </Text>
                  </Row>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878] leading-relaxed">
                    {stringResource(R.string.mesh_concept_zero_cloud_desc)}
                  </Text>
                </Surface>

                <Surface shape="rounded-2xl" className="p-4 bg-white/80 dark:bg-[#1E2B1C] space-y-2">
                  <Row verticalAlignment="center" gap={2}>
                    <div className="p-2 rounded-xl bg-[#E76F51]/15 text-[#E76F51]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <Text style="titleSmall">
                      {stringResource(R.string.mesh_concept_ed25519_title)}
                    </Text>
                  </Row>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878] leading-relaxed">
                    {stringResource(R.string.mesh_concept_ed25519_desc)}
                  </Text>
                </Surface>

                <Surface shape="rounded-2xl" className="p-4 bg-white/80 dark:bg-[#1E2B1C] space-y-2">
                  <Row verticalAlignment="center" gap={2}>
                    <div className="p-2 rounded-xl bg-[#E9C46A]/20 text-[#D4A338]">
                      <Users className="w-4 h-4" />
                    </div>
                    <Text style="titleSmall">
                      {stringResource(R.string.mesh_concept_sybil_title)}
                    </Text>
                  </Row>
                  <Text style="bodySmall" className="text-[#637062] dark:text-[#87A878] leading-relaxed">
                    {stringResource(R.string.mesh_concept_sybil_desc)}
                  </Text>
                </Surface>
              </div>
            </Column>
          )}

          {/* ========================================================
              STEP 4: Offline PMTiles Map & Street Discovery
             ======================================================== */}
          {currentStep === 4 && (
            <Column gap={4} className="animate-in fade-in duration-200">
              <Row verticalAlignment="center" gap={2}>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                  {stringResource(R.string.onboarding_map_discovery_badge)}
                </span>
              </Row>

              <Column gap={1}>
                <Text style="headlineMedium" className="text-[#203A2A] dark:text-[#F0F5EE]">
                  {stringResource(R.string.onboarding_map_discovery_title)}
                </Text>
                <Text style="titleSmall" className="text-[#588157] dark:text-[#87A878]">
                  {stringResource(R.string.onboarding_map_discovery_subtitle)}
                </Text>
                <Text style="bodyMedium" className="text-[#637062] dark:text-[#A8BDA5] pt-1">
                  {stringResource(R.string.onboarding_map_discovery_desc)}
                </Text>
              </Column>

              <HorizontalDivider />

              {/* Map Discovery Visual Card */}
              <div className="p-4 rounded-3xl bg-linear-to-br from-[#E8F0E6] to-[#D5E5D1] dark:from-[#1A2617] dark:to-[#22331E] border border-[#87A878]/35 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#87A878]/25">
                  <div className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-[#588157]" />
                    <span className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                      Tallinna Välikaart (PMTiles)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#588157] text-white font-bold">
                    100% Offline
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-[#87A878]/25 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#588157]">
                      <Footprints className="w-3.5 h-3.5" />
                      <span>Tänavaavastus</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                      Jaluta reaalsete GPS-koordinaatidega, et avada udu all olevaid tänavaid ja teenida punkte.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-[#87A878]/25 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#2A9D8F]">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Varjendid & Allikad</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                      Valideeritud pääste- ja veepunktid, tööriistade laenutused ja hädaabi kogunemiskohad.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-[#87A878]/25 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#E76F51]">
                      <Signal className="w-3.5 h-3.5" />
                      <span>Raadioleviala Jäljed</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                      Kaardista LoRa ja Bluetooth signaali tugevust, et tuvastada levialasid ja pimealasid.
                    </p>
                  </div>
                </div>
              </div>
            </Column>
          )}

          {/* ========================================================
              STEP 5: Navigation & Interaction Guide
             ======================================================== */}
          {currentStep === 5 && (
            <Column gap={4} className="animate-in fade-in duration-200">
              <Row verticalAlignment="center" gap={2}>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                  {stringResource(R.string.onboarding_nav_guide_badge)}
                </span>
              </Row>

              <Column gap={1}>
                <Text style="headlineMedium" className="text-[#203A2A] dark:text-[#F0F5EE]">
                  {stringResource(R.string.onboarding_nav_guide_title)}
                </Text>
                <Text style="titleSmall" className="text-[#588157] dark:text-[#87A878]">
                  {stringResource(R.string.onboarding_nav_guide_subtitle)}
                </Text>
                <Text style="bodyMedium" className="text-[#637062] dark:text-[#A8BDA5] pt-1">
                  {stringResource(R.string.onboarding_nav_guide_desc)}
                </Text>
              </Column>

              <HorizontalDivider />

              {/* 4 Core Tabs Tour */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#1E2B1C] border border-[#87A878]/30 flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#588157]/15 text-[#588157] shrink-0">
                    <Map className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                      1. Väli (Field Map)
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                      Võrguühenduseta kaart, tänavaotsing, varjendid, veepunktid ja teekonna koostamine.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#1E2B1C] border border-[#87A878]/30 flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#2A9D8F]/15 text-[#2A9D8F] shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                      2. Sõnumid (Mesh Chat)
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                      Krüpteeritud otsevestlused naabritega ja hädaolukorra SOS teated eetrisse.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#1E2B1C] border border-[#87A878]/30 flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#E9C46A]/20 text-[#D4A338] shrink-0">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                      3. Ring (Exchange)
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                      Tööriistade, päikeseenergia, seemnete ja oskuste vahetamine ilma rahalise vahenduseta.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#1E2B1C] border border-[#87A878]/30 flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#E76F51]/15 text-[#E76F51] shrink-0">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                      4. Raadio (RF Peers)
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                      Läheduses olevad seadmed, signaali tugevus ja riistvaralise LoRa raadio olek.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Action Dial Callout */}
              <div className="p-3 rounded-2xl bg-[#588157]/10 border border-[#588157]/20 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#588157] text-white shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <p className="text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                  <strong>Kiirmenüü (+):</strong> Ekraani allservas asuv nupp võimaldab sekundiga käivitada SOS-häire, lisada uue ressursi või otsida üle kogu võrgu.
                </p>
              </div>
            </Column>
          )}

          {/* ========================================================
              STEP 6: Review & Node Activation
             ======================================================== */}
          {currentStep === 6 && (
            <Column gap={4} className="animate-in fade-in duration-200">
              <Row verticalAlignment="center" gap={2}>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#588157]/15 text-[#588157]">
                  {stringResource(R.string.onboarding_review_badge)}
                </span>
              </Row>

              <Column gap={1}>
                <Text style="headlineMedium" className="text-[#203A2A] dark:text-[#F0F5EE]">
                  {stringResource(R.string.onboarding_review_title)}
                </Text>
                <Text style="titleSmall" className="text-[#588157] dark:text-[#87A878]">
                  {stringResource(R.string.onboarding_review_subtitle)}
                </Text>
                <Text style="bodySmall" className="text-[#637062] dark:text-[#A8BDA5]">
                  {stringResource(R.string.onboarding_review_desc)}
                </Text>
              </Column>

              <HorizontalDivider />

              {/* Solarpunk Identity Card Preview */}
              <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-br from-[#FAF6EE] to-[#E9DFCE] dark:from-[#182315] dark:to-[#22331E] border-2 border-[#588157]/40 shadow-md space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#87A878]/30">
                  <div className="flex items-center gap-3">
                    <SolarpunkAvatarCanvas seed={avatarSeed || callsign} size={54} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-lg text-[#203A2A] dark:text-[#F0F5EE]">
                          @{callsign}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#588157] text-white">
                          Sõlm Aktiivne
                        </span>
                      </div>
                      <span className="text-xs text-[#588157] dark:text-[#87A878] font-mono flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5" />
                        Tallinna bioregionaalne võrgusõlm
                      </span>
                    </div>
                  </div>
                  <ShieldCheck className="w-7 h-7 text-[#2A9D8F]" />
                </div>

                <div className="text-xs text-[#203A2A] dark:text-[#E2E8F0] italic bg-white/60 dark:bg-black/20 p-2.5 rounded-xl border border-current/10">
                  "{bio || 'Valmis võrguühenduseta vastastikuseks abiks.'}"
                </div>

                {/* Key Attributes Matrix */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white/70 dark:bg-[#1E2B1C] rounded-xl">
                    <span className="text-[#637062] dark:text-[#87A878] text-[10px] block">
                      {stringResource(R.string.summary_visibility_label)}:
                    </span>
                    <span className="font-bold text-[#588157] capitalize">
                      {visibilityPrefs.visibilityMode}
                    </span>
                  </div>

                  <div className="p-2 bg-white/70 dark:bg-[#1E2B1C] rounded-xl">
                    <span className="text-[#637062] dark:text-[#87A878] text-[10px] block">
                      {stringResource(R.string.summary_location_label)}:
                    </span>
                    <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE] capitalize">
                      {visibilityPrefs.locationPrecision}
                    </span>
                  </div>
                </div>

                {/* Chosen Skills Chips */}
                {selectedSkills.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-[#637062] dark:text-[#87A878] uppercase tracking-wider">
                      {stringResource(R.string.summary_skills_label)}:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedSkills.map((sk, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-[#588157]/15 text-[#588157] dark:text-[#87A878] rounded-md text-[11px] font-medium"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cryptographic Key Fingerprint */}
                <div className="pt-2 border-t border-[#87A878]/25 flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#87A878]">
                  <span>{stringResource(R.string.summary_crypto_key_label)}:</span>
                  <span className="text-[#588157] font-bold">
                    ED25519:{avatarSeed.substring(0, 8)}...8f3a
                  </span>
                </div>
              </div>
            </Column>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-5 py-3.5 bg-white/80 dark:bg-[#182315] border-t border-[#87A878]/25 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <OutlinedButton
                onClick={handlePrev}
                leadingIcon={<ChevronLeft className="w-4 h-4" />}
              >
                {stringResource(R.string.btn_prev_step)}
              </OutlinedButton>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-[#637062] hover:text-[#203A2A] dark:hover:text-white px-2 py-1 cursor-pointer"
              >
                {stringResource(R.string.btn_skip)}
              </button>
            )}
          </div>

          <Row verticalAlignment="center" gap={3}>
            <span className="text-xs font-mono text-[#637062] dark:text-[#87A878] hidden sm:inline">
              {stringResource(R.string.step_indicator, currentStep, totalSteps)}
            </span>

            {currentStep < totalSteps ? (
              <Button
                variant="filled"
                onClick={handleNext}
                trailingIcon={<ChevronRight className="w-4 h-4" />}
              >
                {stringResource(R.string.btn_next_step)}
              </Button>
            ) : (
              <Button
                variant="filled"
                onClick={handleFinish}
                className="bg-[#2A9D8F] hover:bg-[#238276] text-white shadow-md"
                leadingIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                {stringResource(R.string.btn_activate_node)}
              </Button>
            )}
          </Row>
        </div>
      </div>
    </div>
  );
};
