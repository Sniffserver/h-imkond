import React, { useState, useMemo } from 'react';
import { SkillExchangeItem, TrustEndorsement, Transaction } from '../types';
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
  Star,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Send,
  HelpCircle,
  Users,
  BadgeCheck,
  HeartHandshake,
  KeyRound,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { soundFeedback } from '../services/utils/soundFeedback';
import { SkillEndorsementNetworkD3 } from './SkillEndorsementNetworkD3';

interface SkillExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: SkillExchangeItem[];
  endorsements?: TrustEndorsement[];
  transactions?: Transaction[];
  onAddSkill: (newSkill: Omit<SkillExchangeItem, 'id' | 'createdAt' | 'endorsementsCount'>) => void;
  onRequestSkillSession?: (
    skill: SkillExchangeItem,
    details?: { preferredTime?: string; sessionFormat?: string; barterOffer?: string; note?: string }
  ) => void;
  onEndorseSkillTrade?: (
    skillId: string,
    recipientCallsign: string,
    comment: string,
    rating?: number,
    transactionId?: string,
    tags?: string[]
  ) => void;
  onOpenChatWithPeer?: (callsign: string) => void;
  isNightMode?: boolean;
  userCallsign: string;
}

type ModalViewTab = 'browse' | 'post' | 'verified_trades' | 'endorsement_network';
type FilterType = 'all' | 'offer' | 'request' | 'verified';

export const SkillExchangeModal: React.FC<SkillExchangeModalProps> = ({
  isOpen,
  onClose,
  skills,
  endorsements = [],
  transactions = [],
  onAddSkill,
  onRequestSkillSession,
  onEndorseSkillTrade,
  onOpenChatWithPeer,
  isNightMode = false,
  userCallsign,
}) => {
  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<ModalViewTab>('browse');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEndorsementsSkillId, setExpandedEndorsementsSkillId] = useState<string | null>(null);

  // Request Session Dialog States
  const [requestingSessionSkill, setRequestingSessionSkill] = useState<SkillExchangeItem | null>(null);
  const [reqPreferredTime, setReqPreferredTime] = useState('This Weekend');
  const [reqSessionFormat, setReqSessionFormat] = useState('Hands-on 1-on-1 Mentorship');
  const [reqBarterOffer, setReqBarterOffer] = useState('');
  const [reqNote, setReqNote] = useState('');

  // Endorse Trade Dialog States
  const [endorsingSkill, setEndorsingSkill] = useState<SkillExchangeItem | null>(null);
  const [endorseRating, setEndorseRating] = useState<number>(5);
  const [endorseComment, setEndorseComment] = useState('');
  const [selectedTradeTagList, setSelectedTradeTagList] = useState<string[]>([
    'Practical Mastery',
    'Patient Teacher',
  ]);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>('');

  // Post Skill Form States
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postType, setPostType] = useState<'offer' | 'request'>('offer');
  const [postCategory, setPostCategory] = useState('Energy & Solar');
  const [postExperienceLevel, setPostExperienceLevel] = useState<
    'Beginner Friendly' | 'Intermediate' | 'Master Practitioner'
  >('Intermediate');
  const [postSessionFormat, setPostSessionFormat] = useState('Hands-on Field Workshop');
  const [postLocationNote, setPostLocationNote] = useState('River Crossing Eco-Barn (Bay 2)');
  const [postAvailabilityText, setPostAvailabilityText] = useState('Saturdays 14:00 - 17:00');
  const [postPrerequisites, setPostPrerequisites] = useState('Bring safety gloves and notebook; tools provided');
  const [postDesiredTrade, setPostDesiredTrade] = useState('Open to trade for heirloom seeds, herbal salves, or sourdough starter');
  const [postTagsInput, setPostTagsInput] = useState('');
  const [requireVerifiedHandshake, setRequireVerifiedHandshake] = useState(true);

  if (!isOpen) return null;

  const categoriesList = [
    'ALL',
    'Energy & Solar',
    'Permaculture',
    'Carpentry & Building',
    'Electronics & Radio',
    'First Aid & Herbal',
    'Water & Sanitation',
    'Food & Fermentation',
  ];

  const availableTradeTags = [
    'Practical Mastery',
    'Patient Teacher',
    'Fair Barter',
    'Safety Minded',
    'Clear Communication',
    'Punctual & Generous',
    'Ecological Wisdom',
  ];

  // Filter skills based on user selections
  const filteredSkills = useMemo(() => {
    return skills.filter((item) => {
      // Type Filter
      if (filterType === 'offer' && item.type !== 'offer') return false;
      if (filterType === 'request' && item.type !== 'request') return false;
      if (filterType === 'verified' && !item.isVerified && (item.endorsementsCount || 0) < 1) return false;

      // Category Filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesMentor = item.providerCallsign.toLowerCase().includes(q);
        const matchesCat = item.category?.toLowerCase().includes(q);
        const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesMentor && !matchesCat && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [skills, filterType, selectedCategory, searchQuery]);

  // Verified endorsements list across all skills
  const allVerifiedEndorsements = useMemo(() => {
    const list: Array<TrustEndorsement & { skillTitle?: string; skillId?: string }> = [];

    // Gather from explicit endorsements array
    endorsements.forEach((e) => {
      list.push(e);
    });

    // Gather from nested skill endorsements if not duplicated
    skills.forEach((s) => {
      s.endorsements?.forEach((se) => {
        if (!list.some((existing) => existing.id === se.id || existing.signatureHash === se.signatureHash)) {
          list.push({
            id: se.id,
            endorserCallsign: se.endorserCallsign,
            recipientCallsign: s.providerCallsign,
            signatureHash: se.signatureHash,
            timestamp: se.timestamp,
            comment: se.comment,
            reputationBonus: 15,
            skillId: s.id,
            skillTitle: s.title,
            rating: se.rating,
            tags: se.tags,
            isTradeVerified: se.isTradeVerified,
          });
        }
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [endorsements, skills]);

  // Handle Submitting a New Skill-Sharing Session
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim()) return;

    soundFeedback.playPacketTransmit();

    const parsedTags = postTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onAddSkill({
      title: postTitle.trim(),
      description: postDescription.trim() || 'Community skill session.',
      type: postType,
      category: postCategory,
      providerCallsign: userCallsign,
      experienceLevel: postExperienceLevel,
      sessionFormat: postSessionFormat,
      locationNote: postLocationNote.trim(),
      availabilityText: postAvailabilityText.trim(),
      prerequisites: postPrerequisites.trim(),
      desiredTrade: postDesiredTrade.trim(),
      tags: parsedTags.length > 0 ? parsedTags : [postCategory],
      isVerified: false,
    });

    // Reset Form
    setPostTitle('');
    setPostDescription('');
    setPostTagsInput('');
    setActiveTab('browse');
  };

  // Handle Requesting a Session
  const handleConfirmSessionRequest = () => {
    if (!requestingSessionSkill) return;
    soundFeedback.playSuccess();

    if (onRequestSkillSession) {
      onRequestSkillSession(requestingSessionSkill, {
        preferredTime: reqPreferredTime,
        sessionFormat: reqSessionFormat,
        barterOffer: reqBarterOffer.trim(),
        note: reqNote.trim(),
      });
    }

    setRequestingSessionSkill(null);
    setReqBarterOffer('');
    setReqNote('');
  };

  // Handle Submitting an Endorsement
  const handleConfirmEndorsement = () => {
    if (!endorsingSkill) return;
    soundFeedback.playSuccess();

    if (onEndorseSkillTrade) {
      onEndorseSkillTrade(
        endorsingSkill.id,
        endorsingSkill.providerCallsign,
        endorseComment.trim() || 'Verified trade and exceptional skill sharing.',
        endorseRating,
        selectedTransactionId || undefined,
        selectedTradeTagList
      );
    }

    setEndorsingSkill(null);
    setEndorseComment('');
    setEndorseRating(5);
  };

  const toggleTradeTag = (tag: string) => {
    if (selectedTradeTagList.includes(tag)) {
      setSelectedTradeTagList(selectedTradeTagList.filter((t) => t !== tag));
    } else {
      setSelectedTradeTagList([...selectedTradeTagList, tag]);
    }
  };

  return (
    <div
      id="skills-exchange-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isNightMode ? 'border-[#2A3B26] bg-[#141E12]' : 'border-[#87A878]/25 bg-white/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E9C46A]/20 border border-[#E9C46A]/40 flex items-center justify-center text-[#9C6644] dark:text-[#E9C46A] shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg sm:text-xl">Community Skills & Sessions</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-[#588157]/15 text-[#588157] dark:text-[#87A878] border border-[#588157]/30">
                  Mesh Knowledge Hub
                </span>
              </div>
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                Browse, post & request skill workshops with verified trade endorsements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
              }`}
              title="Close Skills Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary View Mode Tabs */}
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between gap-2 overflow-x-auto shrink-0 ${
            isNightMode ? 'border-[#2A3B26] bg-[#121A10]' : 'border-[#87A878]/20 bg-[#F4EFE6]'
          }`}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="skills-tab-browse"
              onClick={() => setActiveTab('browse')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-[#203A2A] text-white shadow-xs'
                  : isNightMode
                  ? 'text-[#A8BDA5] hover:bg-[#1A2617]'
                  : 'text-[#637062] hover:bg-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Browse Sessions</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 ml-1">
                {skills.length}
              </span>
            </button>

            <button
              type="button"
              id="skills-tab-post"
              onClick={() => setActiveTab('post')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'post'
                  ? 'bg-[#203A2A] text-white shadow-xs'
                  : isNightMode
                  ? 'text-[#A8BDA5] hover:bg-[#1A2617]'
                  : 'text-[#637062] hover:bg-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Post New Session</span>
            </button>

            <button
              type="button"
              id="skills-tab-verified"
              onClick={() => setActiveTab('verified_trades')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'verified_trades'
                  ? 'bg-[#203A2A] text-white shadow-xs'
                  : isNightMode
                  ? 'text-[#A8BDA5] hover:bg-[#1A2617]'
                  : 'text-[#637062] hover:bg-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Verified Trade Endorsements</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 ml-1">
                {allVerifiedEndorsements.length}
              </span>
            </button>

            <button
              type="button"
              id="skills-tab-network"
              onClick={() => {
                soundFeedback.playClick();
                setActiveTab('endorsement_network');
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'endorsement_network'
                  ? 'bg-[#203A2A] text-white shadow-xs'
                  : isNightMode
                  ? 'text-[#A8BDA5] hover:bg-[#1A2617]'
                  : 'text-[#637062] hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Endorsement Network</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] ml-1 font-mono font-bold">
                D3
              </span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-[#637062] dark:text-[#A8BDA5] hidden sm:block shrink-0">
            Callsign: <span className="font-bold text-[#588157] dark:text-[#E9C46A]">{userCallsign}</span>
          </div>
        </div>

        {/* TAB 1: BROWSE SESSIONS */}
        {activeTab === 'browse' && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Filter & Search Bar */}
            <div
              className={`p-4 border-b space-y-3 shrink-0 ${
                isNightMode ? 'border-[#2A3B26] bg-[#151F13]' : 'border-[#87A878]/20 bg-white/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Offer / Request / Verified Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All Sessions' },
                    { id: 'offer', label: '🎓 Teaching Offers' },
                    { id: 'request', label: '🙋 Learning Requests' },
                    { id: 'verified', label: '⭐ Verified Mentors' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        soundFeedback.playClick();
                        setFilterType(f.id as FilterType);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                        filterType === f.id
                          ? 'bg-[#E9C46A] text-[#203A2A] border-[#E9C46A] font-bold shadow-xs'
                          : isNightMode
                          ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26] hover:text-[#F0F5EE]'
                          : 'bg-white text-[#637062] border-[#87A878]/30 hover:text-[#203A2A]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#637062] dark:text-[#A8BDA5]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics, mentors, tools..."
                    className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border focus:outline-hidden transition-all ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE] focus:border-[#588157]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
                    }`}
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-xs">
                <span className="text-[11px] font-bold text-[#637062] dark:text-[#A8BDA5] shrink-0 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Category:
                </span>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      soundFeedback.playClick();
                      setSelectedCategory(cat);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#588157] text-white font-bold'
                        : isNightMode
                        ? 'bg-[#1A2617] text-[#A8BDA5] hover:bg-[#253621]'
                        : 'bg-white/80 text-[#637062] hover:bg-[#FAF6EE] border border-[#87A878]/20'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Skills Cards Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {filteredSkills.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E9C46A]/10 border border-[#E9C46A]/20 flex items-center justify-center text-[#E9C46A]">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                  <h3 className="font-display font-bold text-base">No matching skill sessions found</h3>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5] max-w-sm mx-auto">
                    Try adjusting your filters or post a new skill-sharing session to broadcast across the local mesh.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('post')}
                    className="px-4 py-2 rounded-xl bg-[#588157] text-white font-bold text-xs hover:bg-[#466845] transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Post First Session</span>
                  </button>
                </div>
              ) : (
                filteredSkills.map((sk) => {
                  const isExpanded = expandedEndorsementsSkillId === sk.id;
                  const itemEndorsements = sk.endorsements || [];
                  const isOwnSkill = sk.providerCallsign === userCallsign;

                  return (
                    <div
                      key={sk.id}
                      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                        isNightMode
                          ? 'bg-[#141F12] border-[#2A3B26] hover:border-[#3E5837]'
                          : 'bg-white border-[#87A878]/30 hover:border-[#87A878]/60'
                      }`}
                    >
                      {/* Card Header: Type Badge, Category & Mentor */}
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md font-bold text-white shadow-2xs ${
                                sk.type === 'offer' ? 'bg-[#2A9D8F]' : 'bg-[#F4A261]'
                              }`}
                            >
                              {sk.type === 'offer' ? '🎓 TEACHING OFFER' : '🙋 LEARNING REQUEST'}
                            </span>

                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#588157]/10 text-[#588157] dark:text-[#87A878] border border-[#588157]/20">
                              {sk.category || 'General Skill'}
                            </span>

                            {sk.sessionFormat && (
                              <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono flex items-center gap-1">
                                <Users className="w-3 h-3 text-[#2A9D8F]" />
                                {sk.sessionFormat}
                              </span>
                            )}

                            {sk.isVerified && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] border border-[#E9C46A]/40 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Verified Trade Mentor
                              </span>
                            )}
                          </div>

                          <h3 className="font-display font-bold text-base sm:text-lg pt-1 text-[#203A2A] dark:text-[#FAF6EE]">
                            {sk.title}
                          </h3>
                        </div>

                        {/* Mentor Callsign Pill */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right text-xs">
                            <div className="font-bold text-[#203A2A] dark:text-[#FAF6EE] flex items-center gap-1">
                              <span>{sk.providerCallsign}</span>
                              {isOwnSkill && (
                                <span className="text-[10px] bg-[#588157] text-white px-1.5 py-0.2 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                              {sk.experienceLevel || 'Practitioner'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed mb-3">
                        {sk.description}
                      </p>

                      {/* Structured Details Matrix */}
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl text-xs mb-3 font-mono ${
                          isNightMode ? 'bg-[#10180E] border border-[#22311E]' : 'bg-[#FAF6EE] border border-[#87A878]/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#E76F51] shrink-0" />
                          <span className="truncate">
                            <strong className="text-[#203A2A] dark:text-[#FAF6EE]">Location:</strong>{' '}
                            {sk.locationNote || 'Off-grid rendezvous'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
                          <span className="truncate">
                            <strong className="text-[#203A2A] dark:text-[#FAF6EE]">Schedule:</strong>{' '}
                            {sk.availabilityText || 'Flexible sessions'}
                          </span>
                        </div>

                        {sk.desiredTrade && (
                          <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                            <HeartHandshake className="w-3.5 h-3.5 text-[#E9C46A] shrink-0" />
                            <span className="truncate">
                              <strong className="text-[#203A2A] dark:text-[#FAF6EE]">Reciprocal Trade:</strong>{' '}
                              {sk.desiredTrade}
                            </span>
                          </div>
                        )}

                        {sk.prerequisites && (
                          <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                            <HelpCircle className="w-3.5 h-3.5 text-[#457B9D] shrink-0" />
                            <span className="truncate">
                              <strong className="text-[#203A2A] dark:text-[#FAF6EE]">Prerequisites:</strong>{' '}
                              {sk.prerequisites}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {sk.tags && sk.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          {sk.tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-[#588157]/10 text-[#588157] dark:text-[#87A878] border border-[#588157]/20"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Verified Trade Endorsements Accordion Header */}
                      <div
                        className={`pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                          isNightMode ? 'border-[#2A3B26]' : 'border-[#87A878]/20'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEndorsementsSkillId(isExpanded ? null : sk.id)
                          }
                          className="flex items-center gap-1.5 font-bold hover:underline cursor-pointer text-[#8C6207] dark:text-[#E9C46A]"
                        >
                          <Star className="w-3.5 h-3.5 fill-current text-[#E9C46A]" />
                          <span>
                            {sk.endorsementsCount || itemEndorsements.length} Verified Endorsements
                          </span>
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-normal">
                            ({isExpanded ? 'Hide' : 'View Reviews'})
                          </span>
                        </button>

                        {/* Card Actions: Request Session & Endorse */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEndorsingSkill(sk)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                              isNightMode
                                ? 'bg-[#182315] text-[#E9C46A] border-[#364E30] hover:bg-[#253621]'
                                : 'bg-[#FAF6EE] text-[#8C6207] border-[#E9C46A]/50 hover:bg-[#E9C46A]/20'
                            }`}
                            title="Endorse this peer for a completed trade"
                          >
                            <Award className="w-3.5 h-3.5 text-[#E9C46A]" />
                            <span>Endorse Trade</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRequestingSessionSkill(sk)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#466845] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Request Session</span>
                          </button>

                          {onOpenChatWithPeer && (
                            <button
                              type="button"
                              onClick={() => onOpenChatWithPeer(sk.providerCallsign)}
                              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                isNightMode
                                  ? 'bg-[#182315] border-[#2A3B26] text-[#A8BDA5] hover:text-white'
                                  : 'bg-white border-[#87A878]/30 text-[#637062] hover:text-[#203A2A]'
                              }`}
                              title={`Direct Message ${sk.providerCallsign} on mesh`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Endorsement Testimonials Feed */}
                      {isExpanded && (
                        <div
                          className={`mt-3 pt-3 border-t space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
                            isNightMode ? 'border-[#2A3B26]' : 'border-[#87A878]/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#637062] dark:text-[#A8BDA5]">
                            <span>Verified Trade Endorsements & Cryptographic Signatures</span>
                            <span className="font-mono text-[10px] text-[#588157] dark:text-[#87A878]">
                              Ed25519 Verified
                            </span>
                          </div>

                          {itemEndorsements.length === 0 ? (
                            <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 text-center text-xs text-[#637062] dark:text-[#A8BDA5]">
                              No written testimonials recorded yet. Be the first to verify a completed trade!
                            </div>
                          ) : (
                            itemEndorsements.map((end) => (
                              <div
                                key={end.id}
                                className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                  isNightMode ? 'bg-[#10170E] border-[#253621]' : 'bg-[#FAF6EE]/80 border-[#87A878]/25'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[#203A2A] dark:text-[#FAF6EE]">
                                      {end.endorserCallsign}
                                    </span>
                                    <span className="flex items-center text-[#E9C46A]">
                                      {Array.from({ length: end.rating || 5 }).map((_, i) => (
                                        <Star key={i} className="w-3 h-3 fill-current" />
                                      ))}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                                    {new Date(end.timestamp).toLocaleDateString()}
                                  </span>
                                </div>

                                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] italic">
                                  "{end.comment}"
                                </p>

                                <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                                  <div className="flex items-center gap-1 text-[#588157] dark:text-[#87A878]">
                                    <BadgeCheck className="w-3 h-3" />
                                    <span>Verified Trade Handshake</span>
                                  </div>
                                  <span className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono">
                                    {end.signatureHash}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: POST NEW SESSION */}
        {activeTab === 'post' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0">
            <form onSubmit={handleCreatePost} className="max-w-2xl mx-auto space-y-4">
              <div className="space-y-1 mb-2">
                <h3 className="font-display font-bold text-base sm:text-lg">Publish a Skill-Sharing Session</h3>
                <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                  Broadcast your practical expertise or propose a community study workshop across the local mesh network.
                </p>
              </div>

              {/* Offer vs Request Selector */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#588157]">
                  Session Intention:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundFeedback.playClick();
                      setPostType('offer');
                    }}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      postType === 'offer'
                        ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-sm'
                        : isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                        : 'bg-white border-[#87A878]/30 text-[#637062]'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5" />
                    <span>🎓 I Want to Host / Teach</span>
                    <span className="text-[10px] font-normal opacity-85">Share knowledge with neighbors</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundFeedback.playClick();
                      setPostType('request');
                    }}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      postType === 'request'
                        ? 'bg-[#F4A261] text-white border-[#F4A261] shadow-sm'
                        : isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] text-[#A8BDA5]'
                        : 'bg-white border-[#87A878]/30 text-[#637062]'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>🙋 I Seek a Mentor / Workshop</span>
                    <span className="text-[10px] font-normal opacity-85">Learn a practical survival craft</span>
                  </button>
                </div>
              </div>

              {/* Skill Title */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Session Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g., 12V LiFePO4 Solar Battery Assembly & BMS Balancing"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden transition-colors ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE] focus:border-[#588157]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A] focus:border-[#588157]'
                  }`}
                />
              </div>

              {/* Category, Experience & Format Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Category:</label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  >
                    <option value="Energy & Solar">Energy & Solar</option>
                    <option value="Permaculture">Permaculture & Garden</option>
                    <option value="Carpentry & Building">Carpentry & Building</option>
                    <option value="Electronics & Radio">Electronics & Radio</option>
                    <option value="First Aid & Herbal">First Aid & Herbal</option>
                    <option value="Water & Sanitation">Water Systems</option>
                    <option value="Food & Fermentation">Food & Fermentation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Experience Level:</label>
                  <select
                    value={postExperienceLevel}
                    onChange={(e) => setPostExperienceLevel(e.target.value as any)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  >
                    <option value="Beginner Friendly">Beginner Friendly</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Master Practitioner">Master Practitioner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Session Format:</label>
                  <select
                    value={postSessionFormat}
                    onChange={(e) => setPostSessionFormat(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  >
                    <option value="Hands-on Field Workshop">Hands-on Field Workshop</option>
                    <option value="1-on-1 Field Mentorship">1-on-1 Mentorship</option>
                    <option value="Practical Lab">Practical Hands-on Lab</option>
                    <option value="Small Circle Gathering">Small Circle Gathering</option>
                    <option value="Mesh Study Group">Async / Mesh Study</option>
                  </select>
                </div>
              </div>

              {/* Location & Availability Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">
                    Location / Rendezvous:
                  </label>
                  <input
                    type="text"
                    value={postLocationNote}
                    onChange={(e) => setPostLocationNote(e.target.value)}
                    placeholder="e.g., River Crossing Hub or Tool Barn #2"
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">
                    Schedule & Timing:
                  </label>
                  <input
                    type="text"
                    value={postAvailabilityText}
                    onChange={(e) => setPostAvailabilityText(e.target.value)}
                    placeholder="e.g., Saturdays 14:00 - 17:00"
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Session Overview & Learning Objectives:
                </label>
                <textarea
                  rows={3}
                  required
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  placeholder="Detail what practical skills will be demonstrated, tools used, and what participants will build or practice..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden resize-none ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              {/* Barter & Prerequisites */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">
                    Reciprocal Barter / Desired Trade:
                  </label>
                  <input
                    type="text"
                    value={postDesiredTrade}
                    onChange={(e) => setPostDesiredTrade(e.target.value)}
                    placeholder="e.g., Looking for heirloom seeds or help with carpentry"
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">
                    Prerequisites / What to Bring:
                  </label>
                  <input
                    type="text"
                    value={postPrerequisites}
                    onChange={(e) => setPostPrerequisites(e.target.value)}
                    placeholder="e.g., Bring sturdy gloves and safety glasses"
                    className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Keywords / Skills Tags (comma separated):
                </label>
                <input
                  type="text"
                  value={postTagsInput}
                  onChange={(e) => setPostTagsInput(e.target.value)}
                  placeholder="e.g., Solar, LiFePO4, OffGrid, Wiring"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              {/* Verified Trade Handshake Checkbox */}
              <div
                className={`p-3 rounded-xl border flex items-start gap-3 text-xs ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                }`}
              >
                <input
                  type="checkbox"
                  id="require-verified-handshake"
                  checked={requireVerifiedHandshake}
                  onChange={(e) => setRequireVerifiedHandshake(e.target.checked)}
                  className="mt-0.5 rounded cursor-pointer text-[#588157] focus:ring-[#588157]"
                />
                <label htmlFor="require-verified-handshake" className="cursor-pointer space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5 text-[#203A2A] dark:text-[#FAF6EE]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#E9C46A]" />
                    <span>Include in Verified Trade Endorsement Registry</span>
                  </div>
                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                    Enables participants to digitally sign an Ed25519 trust voucher upon session completion, building mutual community symbiosis.
                  </p>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!postTitle.trim()}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-[#203A2A] text-white hover:bg-[#16271c] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-[#E9C46A]" />
                <span>Broadcast Skill Session to Local Mesh</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: VERIFIED TRADES & ENDORSEMENTS REGISTRY */}
        {activeTab === 'verified_trades' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 min-h-0">
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E9C46A]" />
                <h3 className="font-display font-bold text-base sm:text-lg">
                  Verified Trade Endorsement Ledger
                </h3>
              </div>
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                Cryptographically attested mutual aid exchanges and skill mentor vouchers across the local mesh network.
              </p>
            </div>

            <div className="space-y-3">
              {allVerifiedEndorsements.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#637062] dark:text-[#A8BDA5]">
                  No verified trade endorsements on record yet.
                </div>
              ) : (
                allVerifiedEndorsements.map((end) => (
                  <div
                    key={end.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isNightMode ? 'bg-[#141F12] border-[#2A3B26]' : 'bg-white border-[#87A878]/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] flex items-center justify-center font-bold text-xs">
                          {end.endorserCallsign.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <span>{end.endorserCallsign}</span>
                            <ArrowRight className="w-3 h-3 text-[#637062]" />
                            <span className="text-[#588157] dark:text-[#E9C46A]">{end.recipientCallsign}</span>
                          </div>
                          {end.skillTitle && (
                            <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                              Topic: {end.skillTitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[#E9C46A]">
                        {Array.from({ length: end.rating || 5 }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed mb-2.5">
                      "{end.comment}"
                    </p>

                    {end.tags && end.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                        {end.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-[#2A9D8F]/10 text-[#2A9D8F] font-mono"
                          >
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${
                        isNightMode ? 'border-[#22311E] text-[#A8BDA5]' : 'border-[#87A878]/15 text-[#637062]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[#588157] dark:text-[#87A878] font-bold">
                          <BadgeCheck className="w-3 h-3" />
                          Trade Verified
                        </span>
                        {end.transactionId && <span>Tx #{end.transactionId}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        <span>{new Date(end.timestamp).toLocaleDateString()}</span>
                        <span className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {end.signatureHash}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SKILL ENDORSEMENT NETWORK GRAPH (D3) */}
        {activeTab === 'endorsement_network' && (
          <div className="flex-1 overflow-hidden p-3 sm:p-4 min-h-0 flex flex-col">
            <SkillEndorsementNetworkD3
              skills={skills}
              endorsements={endorsements}
              userCallsign={userCallsign}
              onSelectSkill={(skill) => {
                setExpandedEndorsementsSkillId(skill.id);
              }}
              onRequestSession={(skill) => {
                setRequestingSessionSkill(skill);
              }}
              onEndorseSkill={(skill) => {
                setEndorsingSkill(skill);
              }}
              onOpenChatWithPeer={onOpenChatWithPeer}
              isNightMode={isNightMode}
            />
          </div>
        )}

        {/* DIALOG 1: REQUEST SESSION INTERACTION */}
        {requestingSessionSkill && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg rounded-3xl border shadow-2xl p-5 sm:p-6 space-y-4 ${
                isNightMode
                  ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                  : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#588157]/20 text-[#588157] dark:text-[#87A878] flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base">Request Skill Session</h3>
                    <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                      Connecting with mentor {requestingSessionSkill.providerCallsign}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRequestingSessionSkill(null)}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Skill Brief */}
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
                }`}
              >
                <div className="font-bold">{requestingSessionSkill.title}</div>
                <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                  Location: {requestingSessionSkill.locationNote} • Schedule: {requestingSessionSkill.availabilityText}
                </div>
              </div>

              {/* Preferred Timeframe */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Preferred Timeframe / Schedule:
                </label>
                <select
                  value={reqPreferredTime}
                  onChange={(e) => setReqPreferredTime(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                >
                  <option value="This Weekend">This Weekend (Saturday/Sunday)</option>
                  <option value="Weekday Evening">Weekday Evening (after 18:00)</option>
                  <option value="Weekday Morning">Weekday Morning (solar peak)</option>
                  <option value="Flexible / Mesh Rendezvous">Flexible / Direct Mesh Coordination</option>
                </select>
              </div>

              {/* Preferred Format */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Session Format:
                </label>
                <select
                  value={reqSessionFormat}
                  onChange={(e) => setReqSessionFormat(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                >
                  <option value="Hands-on 1-on-1 Mentorship">Hands-on 1-on-1 Mentorship</option>
                  <option value="Group Field Workshop">Small Group Field Workshop</option>
                  <option value="Field Walk & Identification">Field Walk & Practical Demo</option>
                  <option value="Async Mesh Packets / Q&A">Offline Mesh Q&A Exchange</option>
                </select>
              </div>

              {/* Reciprocal Trade Proposal */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Proposed Reciprocal Barter / Mutual Aid Offer:
                </label>
                <input
                  type="text"
                  value={reqBarterOffer}
                  onChange={(e) => setReqBarterOffer(e.target.value)}
                  placeholder="e.g., 2 jars herbal salve + 2h garden bed preparation"
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              {/* Note to Mentor */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Personal Note to Mentor:
                </label>
                <textarea
                  rows={2}
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  placeholder="Share your background or specific questions you'd like to explore..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden resize-none ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestingSessionSkill(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer text-[#637062] dark:text-[#A8BDA5]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSessionRequest}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#588157] text-white hover:bg-[#466845] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Session Request</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG 2: ENDORSE PEER FOR VERIFIED TRADE */}
        {endorsingSkill && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg rounded-3xl border shadow-2xl p-5 sm:p-6 space-y-4 ${
                isNightMode
                  ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                  : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base">Sign Verified Trade Endorsement</h3>
                    <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                      Attesting for {endorsingSkill.providerCallsign} on "{endorsingSkill.title}"
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEndorsingSkill(null)}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rating Selector */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Endorsement Rating:
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEndorseRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= endorseRating
                            ? 'text-[#E9C46A] fill-[#E9C46A]'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-mono font-bold ml-2">
                    {endorseRating} / 5 Stars
                  </span>
                </div>
              </div>

              {/* Endorsement Tags */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#588157]">
                  Select Verified Trade Badges:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTradeTags.map((tag) => {
                    const isSelected = selectedTradeTagList.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTradeTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                            : isNightMode
                            ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                            : 'bg-white text-[#637062] border-[#87A878]/30'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Written Testimonial */}
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Written Testimonial / Trade Reflection:
                </label>
                <textarea
                  rows={3}
                  required
                  value={endorseComment}
                  onChange={(e) => setEndorseComment(e.target.value)}
                  placeholder="Describe the trade or learning experience: clarity of instructions, practical mastery, prompt communication..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden resize-none ${
                    isNightMode ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]' : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              {/* Cryptographic Proof Preview */}
              <div
                className={`p-3 rounded-xl border text-[11px] font-mono space-y-1 ${
                  isNightMode ? 'bg-[#10170E] border-[#22311E] text-[#A8BDA5]' : 'bg-white border-[#87A878]/25 text-[#637062]'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[#588157] dark:text-[#87A878]">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    Attestation Hash Preview
                  </span>
                  <span>+15 Symbiosis Pts</span>
                </div>
                <div className="text-[10px] truncate text-[#637062] dark:text-[#A8BDA5]">
                  ED25519_SIG: {userCallsign} ➔ {endorsingSkill.providerCallsign} (SHA256 verified)
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEndorsingSkill(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer text-[#637062] dark:text-[#A8BDA5]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndorsement}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#203A2A] text-white hover:bg-[#16271c] transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-[#E9C46A]" />
                  <span>Sign & Publish Endorsement</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
