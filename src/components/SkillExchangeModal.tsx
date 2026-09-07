import React, { useState } from 'react';
import { SkillExchangeItem } from '../types';
import {
  X,
  GraduationCap,
  Plus,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Award,
  Search,
} from 'lucide-react';

interface SkillExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: SkillExchangeItem[];
  onAddSkill: (newSkill: Omit<SkillExchangeItem, 'id' | 'createdAt' | 'endorsementsCount'>) => void;
  onRequestSkillSession: (skill: SkillExchangeItem) => void;
  isNightMode?: boolean;
  userCallsign: string;
}

export const SkillExchangeModal: React.FC<SkillExchangeModalProps> = ({
  isOpen,
  onClose,
  skills,
  onAddSkill,
  onRequestSkillSession,
  isNightMode = false,
  userCallsign,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'offer' | 'request'>('all');
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'offer' | 'request'>('offer');
  const [category, setCategory] = useState('Energy & Solar');
  const [experienceLevel, setExperienceLevel] = useState<'Beginner Friendly' | 'Intermediate' | 'Master Practitioner'>('Intermediate');
  const [locationNote, setLocationNote] = useState('Ridge Trailhead Workshop or BLE Mesh');

  if (!isOpen) return null;

  const filteredSkills = skills.filter((s) => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.providerCallsign.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddSkill({
      title: title.trim(),
      description: description.trim() || 'Skill teaching/learning offer.',
      type,
      category,
      providerCallsign: userCallsign,
      experienceLevel,
      locationNote,
      availabilityText: 'Flexible weekend sessions',
    });

    setTitle('');
    setDescription('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 max-h-[90vh] flex flex-col ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E9C46A]/20 border border-[#E9C46A]/40 flex items-center justify-center text-[#E9C46A]">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl">Oskuste Vahetus / Skill Exchange</h2>
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                Share technical expertise, solar wiring, permaculture & crafting with community peers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-3.5 py-2 rounded-xl bg-[#203A2A] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-[#16271c] cursor-pointer"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isAdding ? 'Cancel' : 'Offer/Request Skill'}</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        {!isAdding && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-current/10 pb-3 shrink-0 text-xs">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All Skills' },
                { id: 'offer', label: 'Teaching Offers' },
                { id: 'request', label: 'Learning Requests' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                    filterType === f.id
                      ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] font-bold'
                      : isNightMode
                      ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                      : 'bg-white text-[#637062] border-[#87A878]/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#637062]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..."
                className={`pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-hidden ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE]' : 'bg-white border-[#87A878]/30'
                }`}
              />
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-3">
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-3.5 p-1">
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('offer')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      type === 'offer'
                        ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                        : isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                        : 'bg-white border-[#87A878]/30 text-[#637062]'
                    }`}
                  >
                    🎓 I Want to Teach / Offer Skill
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('request')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      type === 'request'
                        ? 'bg-[#F4A261] text-white border-[#F4A261]'
                        : isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                        : 'bg-white border-[#87A878]/30 text-[#637062]'
                    }`}
                  >
                    🙋 I Want to Learn / Request Mentor
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Skill Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Õpetan päikesepaneelide paigaldamist & akupanga juhtmestikku"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  >
                    <option value="Energy & Solar">Energy & Solar (Päikeseenergia)</option>
                    <option value="Permaculture">Permaculture & Seed Saving (Permakultuur)</option>
                    <option value="Carpentry & Building">Carpentry & Building (Ehitus & Puit)</option>
                    <option value="Electronics & Radio">Electronics & Radio (Mesh raadio)</option>
                    <option value="First Aid & Herbal">First Aid & Herbal (Esmaabi & Taimed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Experience Level:</label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value as any)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  >
                    <option value="Beginner Friendly">Beginner Friendly (Algajale sobiv)</option>
                    <option value="Intermediate">Intermediate (Kesktase)</option>
                    <option value="Master Practitioner">Master Practitioner (Meister)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">Description:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what will be taught or what assistance you need..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden resize-none ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!title.trim()}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-[#203A2A] text-white hover:bg-[#16271c] transition-all cursor-pointer shadow-md"
              >
                Broadcast Skill Listing to Local Mesh
              </button>
            </form>
          ) : (
            filteredSkills.map((sk) => (
              <div
                key={sk.id}
                className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE]'
                    : 'bg-white border-[#87A878]/30 text-[#203A2A]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold text-white ${
                          sk.type === 'offer' ? 'bg-[#2A9D8F]' : 'bg-[#F4A261]'
                        }`}
                      >
                        {sk.type === 'offer' ? 'TEACHING OFFER' : 'LEARNING REQUEST'}
                      </span>
                      <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                        Mentor: {sk.providerCallsign}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-base">{sk.title}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRequestSkillSession(sk)}
                    className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[#588157] text-white hover:bg-[#466845] flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Connect / Taotle</span>
                  </button>
                </div>

                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                  {sk.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-current/10 text-xs font-mono text-[#637062] dark:text-[#A8BDA5]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[#2A9D8F]">
                      <Award className="w-3.5 h-3.5" /> {sk.experienceLevel}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E76F51]" /> {sk.locationNote}
                    </span>
                  </div>

                  <span className="text-[10px] bg-[#E9C46A]/20 text-[#203A2A] dark:text-[#E9C46A] px-2 py-0.5 rounded-md font-bold">
                    ★ {sk.endorsementsCount} Peer Endorsements
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
