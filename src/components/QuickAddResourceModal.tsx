import React, { useState, useRef } from 'react';
import { ResourceCategory } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  X,
  PlusCircle,
  Radio,
  Zap,
  Wrench,
  GraduationCap,
  Sprout,
  Home,
  HeartPulse,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  BellRing,
  Camera,
  MapPin,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

import placeholderTools from '../assets/images/placeholder_tools_1788523677665.jpg';
import placeholderFood from '../assets/images/placeholder_food_1788523700307.jpg';
import placeholderEnergy from '../assets/images/placeholder_energy_1788523715864.jpg';
import placeholderSkills from '../assets/images/placeholder_skills_1788523731794.jpg';
import placeholderCare from '../assets/images/placeholder_care_1788523751128.jpg';
import placeholderRemedy from '../assets/images/placeholder_remedy_1788523765920.jpg';

interface QuickAddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: ResourceCategory;
    type: 'offer' | 'request';
    availabilityText: string;
    imageUrl?: string;
    coordinates?: { x: number; y: number; name?: string };
  }) => void;
  isNightMode?: boolean;
  onOpenWishlist?: () => void;
  activeWishlistMatchesCount?: number;
}

export const QuickAddResourceModal: React.FC<QuickAddResourceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isNightMode = false,
  onOpenWishlist,
  activeWishlistMatchesCount = 0,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<'offer' | 'request'>('offer');
  const [category, setCategory] = useState<ResourceCategory>('Tools');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availabilityText, setAvailabilityText] = useState('Available immediately at home node');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('Home Node (Cascadia-44N)');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap({ isOpen, onClose, modalName: 'Quick Add Resource Modal' });

  if (!isOpen) return null;

  const locationsList = [
    { name: 'Home Node (Cascadia-44N)', x: 0, y: 0, dist: 0.1 },
    { name: 'River Crossing (Node 03)', x: 120, y: -80, dist: 0.8 },
    { name: 'Ridge Trailhead (Node 02)', x: -140, y: 110, dist: 1.2 },
    { name: 'South Bridge Relay', x: 80, y: 150, dist: 1.4 },
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const categories: { name: ResourceCategory; icon: React.ReactNode; color: string; desc: string }[] = [
    { name: 'Tools', icon: <Wrench className="w-4 h-4" />, color: '#2A9D8F', desc: 'Hardware, solar gear & equipment' },
    { name: 'Food', icon: <Sprout className="w-4 h-4" />, color: '#87A878', desc: 'Produce, heritage seeds & preserves' },
    { name: 'Energy', icon: <Zap className="w-4 h-4" />, color: '#F4A261', desc: 'Battery banks, solar panels & power' },
    { name: 'Skills', icon: <GraduationCap className="w-4 h-4" />, color: '#E9C46A', desc: 'Repair, craft & ecological knowledge' },
    { name: 'Care & Housing', icon: <Home className="w-4 h-4" />, color: '#588157', desc: 'Shelter, child care & community aid' },
    { name: 'Bio-Remedy', icon: <HeartPulse className="w-4 h-4" />, color: '#E76F51', desc: 'Herbal medicine & first aid supplies' },
    { name: 'Electronics', icon: <Radio className="w-4 h-4" />, color: '#6366F1', desc: 'Radios, batteries & solar controllers' },
  ];

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!title.trim()) return;
      setStep(3);
    } else if (step === 3) {
      const locObj = locationsList.find((l) => l.name === selectedLocation) || locationsList[0];
      onSubmit({
        title,
        description,
        category,
        type,
        availabilityText,
        imageUrl: imageUrl || undefined,
        coordinates: { x: locObj.x, y: locObj.y, name: locObj.name },
      });
      // Reset form
      setStep(1);
      setTitle('');
      setDescription('');
      setImageUrl('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-modal-title"
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title & Step Bar */}
        <div className="flex items-center justify-between pr-8 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#588157]/20 border border-[#87A878]/40 flex items-center justify-center text-[#588157] dark:text-[#87A878]">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="quick-add-modal-title" className="font-display font-bold text-lg">
                {step === 1 && '1. Choose Type & Category'}
                {step === 2 && '2. Asset Title & Details'}
                {step === 3 && '3. Cryptographic Mesh Preview'}
              </h2>
              <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                Step {step} of 3 • Zero-Cloud BLE Mesh Broadcast
              </p>
            </div>
          </div>

          {/* Step Indicator dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  step === s
                    ? 'w-6 bg-[#588157]'
                    : step > s
                    ? 'w-2 bg-[#2A9D8F]'
                    : isNightMode
                    ? 'w-2 bg-[#2A3B26]'
                    : 'w-2 bg-[#E6EDE1]'
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleNext}>
          {/* STEP 1: Offer vs Request & Category */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Offer vs Request toggle */}
              <div>
                <label className="block text-xs font-bold mb-2 text-[#588157]">
                  What are you posting?
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setType('offer')}
                    className={`py-3 px-4 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      type === 'offer'
                        ? 'bg-[#588157] text-white border-[#588157] shadow-sm'
                        : isNightMode
                        ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                        : 'bg-white text-[#637062] border-[#87A878]/30'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-[#E9C46A]" />
                    <span>Offering Asset / Skill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('request')}
                    className={`py-3 px-4 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      type === 'request'
                        ? 'bg-[#E76F51] text-white border-[#E76F51] shadow-sm'
                        : isNightMode
                        ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                        : 'bg-white text-[#637062] border-[#87A878]/30'
                    }`}
                  >
                    <Radio className="w-4 h-4 text-white" />
                    <span>Requesting / Need</span>
                  </button>
                </div>
              </div>

              {/* Category Grid */}
              <div>
                <label className="block text-xs font-bold mb-2 text-[#588157]">
                  Select Resource Category:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                        category === cat.name
                          ? isNightMode
                            ? 'bg-[#2A3B26] border-[#87A878] text-[#F0F5EE] shadow-sm'
                            : 'bg-white border-[#588157] text-[#203A2A] shadow-md ring-2 ring-[#588157]/20'
                          : isNightMode
                          ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5] hover:border-[#364E30]'
                          : 'bg-white/80 border-[#87A878]/25 text-[#637062] hover:border-[#87A878]/60'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{cat.name}</div>
                        <div className="text-[10px] opacity-75 truncate">{cat.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wishlist Matches Incentive Banner */}
              {activeWishlistMatchesCount > 0 && (
                <div className="p-3 rounded-2xl bg-[#E76F51]/10 border border-[#E76F51]/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[#E76F51] min-w-0">
                    <Sparkles className="w-4 h-4 shrink-0 text-[#E76F51]" />
                    <span className="font-semibold truncate">
                      {activeWishlistMatchesCount} active wishlist match{activeWishlistMatchesCount === 1 ? '' : 'es'} found in recent scan!
                    </span>
                  </div>
                  {onOpenWishlist && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenWishlist();
                      }}
                      className="text-[#E76F51] hover:underline font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      View Alerts
                    </button>
                  )}
                </div>
              )}

              {/* Wishlist Hint */}
              {onOpenWishlist && (
                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-[#637062] dark:text-[#A8BDA5]">
                    Looking for something specific?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenWishlist();
                    }}
                    className="text-[#2A9D8F] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    Manage Wishlist Alerts
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Title & Details */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Resource Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === 'offer'
                      ? 'e.g. 50W Portable Foldable Solar Charger'
                      : 'e.g. Looking for Heritage Tomato Seeds'
                  }
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition-colors ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE] focus:border-[#87A878]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Description & Specifications
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide technical specs, usage guidelines, or condition details for community peers..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden transition-colors resize-none ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE] focus:border-[#87A878]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
                  }`}
                />
              </div>

              {/* Image Attachment Options */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Asset Illustration / Photo:
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />

                {imageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-[#87A878]/40 h-28 bg-black/10 group">
                    <img src={imageUrl} alt="Resource preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/70 text-white px-2 py-0.5 rounded-md">
                      {imageUrl.startsWith('data:') ? '📷 Local Base64 Blob Attached' : '🎨 Default Illustration'}
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const placeholders: Record<string, string> = {
                          'Tools': placeholderTools,
                          'Food': placeholderFood,
                          'Energy': placeholderEnergy,
                          'Skills': placeholderSkills,
                          'Care & Housing': placeholderCare,
                          'Bio-Remedy': placeholderRemedy,
                          'Electronics': placeholderEnergy,
                        };
                        setImageUrl(placeholders[category] || placeholderTools);
                      }}
                      className={`flex-1 py-3 px-4 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-colors ${
                        isNightMode
                          ? 'bg-[#121A10] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                          : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 text-[#E9C46A]" />
                      <span>Use {category} Icon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 py-3 px-4 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition-colors ${
                        isNightMode
                          ? 'bg-[#121A10] border-[#364E30] text-[#A8BDA5] hover:bg-[#2A3B26]'
                          : 'bg-white border-[#87A878]/40 text-[#637062] hover:bg-[#FAF6EE]'
                      }`}
                    >
                      <Camera className="w-4 h-4 text-[#2A9D8F]" />
                      <span>Upload Photo</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Location Picker on Offline Map */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Select Grid Location (Offline Map):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {locationsList.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc.name);
                        setAvailabilityText(`Located at ${loc.name} (~${loc.dist} km)`);
                      }}
                      className={`p-2 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                        selectedLocation === loc.name
                          ? 'bg-[#588157] text-white border-[#588157]'
                          : isNightMode
                          ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                          : 'bg-white border-[#87A878]/30 text-[#637062]'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-[#E9C46A]" />
                      <span className="truncate">{loc.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Availability & Access Note
                </label>
                <input
                  type="text"
                  value={availabilityText}
                  onChange={(e) => setAvailabilityText(e.target.value)}
                  placeholder="e.g. Available at Ridge Node 04 or via BLE relay"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden transition-colors ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE] focus:border-[#87A878]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
                  }`}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Cryptographic Preview & Broadcast */}
          {step === 3 && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl border ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#364E30]'
                    : 'bg-white border-[#87A878]/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2A9D8F]">
                    {type === 'offer' ? 'OFFER BEACON (PAKKUMINE)' : 'NEED BEACON (SOOV)'} • {category}
                  </span>
                  <span className="text-[10px] font-mono text-[#588157] bg-[#588157]/15 px-2 py-0.5 rounded-md font-bold">
                    +10 Symbiosis Pts
                  </span>
                </div>

                {imageUrl && (
                  <div className="mb-2 h-24 rounded-xl overflow-hidden border border-[#87A878]/30">
                    <img src={imageUrl} alt="Asset thumbnail" className="w-full h-full object-cover" />
                  </div>
                )}

                <h3 className="font-display font-bold text-base mb-1">{title}</h3>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mb-3 line-clamp-2">
                  {description || 'No detailed description provided.'}
                </p>

                <div className="pt-2 border-t border-current/10 flex items-center justify-between text-[11px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                  <span>📍 {selectedLocation}</span>
                  <span>⚡ Payload: {imageUrl ? '2.4 KB (Optimized Base64)' : '128 Bytes BLE'}</span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  isNightMode ? 'bg-[#223120] border-[#364E30]' : 'bg-[#F0F5EE] border-[#87A878]/30'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-[#2A9D8F] shrink-0" />
                <div>
                  <div className="font-bold text-[#2A9D8F]">Ready for Zero-Cloud Propagation</div>
                  <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                    This item will immediately sync with nearby mesh peers and trigger any active wishlist alerts.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons Footer */}
          <div className="mt-6 pt-4 border-t border-current/10 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className={`py-2.5 px-4 rounded-xl border font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isNightMode
                    ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26] hover:bg-[#2A3B26]'
                    : 'bg-white text-[#637062] border-[#87A878]/30 hover:bg-[#E6EDE1]'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={`py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                  isNightMode ? 'text-[#A8BDA5] hover:bg-[#2A3B26]' : 'text-[#637062] hover:bg-[#E6EDE1]'
                }`}
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={step === 2 && !title.trim()}
              className={`py-2.5 px-5 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                step === 2 && !title.trim()
                  ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white'
                  : 'bg-[#203A2A] hover:bg-[#16271c] text-white active:scale-95'
              }`}
            >
              <span>{step === 3 ? 'Broadcast to Mesh' : 'Next Step'}</span>
              {step < 3 ? <ArrowRight className="w-4 h-4" /> : <Radio className="w-4 h-4 text-[#E9C46A]" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
