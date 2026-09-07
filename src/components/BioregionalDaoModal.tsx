import React, { useState } from 'react';
import { DaoProposal, UserProfile, ProposalCategory } from '../types';
import {
  X,
  Vote,
  Award,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  PlusCircle,
  Zap,
  TrendingUp,
  Landmark,
  Radio,
  BarChart3,
  Flame,
} from 'lucide-react';

interface BioregionalDaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  proposals: DaoProposal[];
  onVoteProposal: (proposalId: string, vote: 'yes' | 'no' | 'abstain') => void;
  onCreateProposal: (newProposal: {
    title: string;
    description: string;
    category: ProposalCategory;
  }) => void;
  isNightMode?: boolean;
}

export const BioregionalDaoModal: React.FC<BioregionalDaoModalProps> = ({
  isOpen,
  onClose,
  user,
  proposals,
  onVoteProposal,
  onCreateProposal,
  isNightMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'proposals' | 'gamification' | 'create'>('proposals');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<ProposalCategory>('Infrastructure');

  if (!isOpen) return null;

  // Symbiosis Level & Tier Calculation
  const getSymbiosisTierInfo = (score: number) => {
    if (score >= 651) {
      return {
        title: '☀️ Sunward Sentinel',
        level: 4,
        nextThreshold: 1000,
        badgeBg: 'bg-[#E9C46A]',
        desc: 'Bioregional pillar anchor guiding mesh infrastructure & council policy.',
      };
    } else if (score >= 351) {
      return {
        title: '🌳 Bioregional Steward',
        level: 3,
        nextThreshold: 650,
        badgeBg: 'bg-[#588157]',
        desc: 'Trusted community anchor managing mutual aid exchanges & seed vaults.',
      };
    } else if (score >= 151) {
      return {
        title: '🌿 Canopy Weaver',
        level: 2,
        nextThreshold: 350,
        badgeBg: 'bg-[#2A9D8F]',
        desc: 'Active node router expanding neighborhood BLE mesh relays.',
      };
    } else {
      return {
        title: '🌱 Seedling Pioneer',
        level: 1,
        nextThreshold: 150,
        badgeBg: 'bg-[#87A878]',
        desc: 'New community member building trust through localized offers.',
      };
    }
  };

  const tierInfo = getSymbiosisTierInfo(user.symbiosisScore);
  const prevThreshold = tierInfo.level === 1 ? 0 : tierInfo.level === 2 ? 150 : tierInfo.level === 3 ? 350 : 650;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((user.symbiosisScore - prevThreshold) / (tierInfo.nextThreshold - prevThreshold)) * 100)
  );

  const badges = [
    { name: 'Zero-Grid Mesh Anchor', icon: '📡', unlocked: user.completedExchanges >= 1, desc: 'Completed 1+ offline mutual aid exchange' },
    { name: 'First Solar Harvest', icon: '☀️', unlocked: user.symbiosisScore >= 200, desc: 'Reached 200+ Symbiosis Score' },
    { name: 'DAO Delegate', icon: '🏛️', unlocked: proposals.some((p) => p.userVoted), desc: 'Voted on a Bioregional Council Proposal' },
    { name: 'Tänava Avastaja', icon: '🗺️', unlocked: !!user.exploredStreets && user.exploredStreets.length > 0, desc: 'Avastasid täielikult vähemalt ühe kohaliku tänava!' },
    { name: 'Pidev Kõndija', icon: '🔥', unlocked: !!user.streakDays && user.streakDays >= 1, desc: `Saavutasid kõndimise seeria (${user.streakDays || 0} päeva)` },
    { name: 'Resilient Neighbor', icon: '🤝', unlocked: user.completedExchanges >= 5, desc: 'Facilitated 5+ community exchanges' },
    { name: 'Seed Vault Keeper', icon: '🌱', unlocked: true, desc: 'Zero-Cloud local ledger initialized' },
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateProposal({
      title: newTitle.trim(),
      description: newDesc.trim() || 'Community proposed bioregional improvement.',
      category: newCat,
    });
    setNewTitle('');
    setNewDesc('');
    setActiveTab('proposals');
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
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-[#E9C46A]/20 border border-[#E9C46A]/40 flex items-center justify-center text-[#8C6207] dark:text-[#E9C46A] shadow-xs">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#588157]/20 text-[#588157] dark:text-[#87A878] text-[10px] font-mono font-bold mb-0.5">
              <ShieldCheck className="w-3 h-3" />
              Direct Democracy • Weighted Voting
            </div>
            <h2 className="font-display font-bold text-xl">Bioregional Mesh DAO & Governance</h2>
          </div>
        </div>

        {/* Top Tab Bar Navigation */}
        <div className="flex items-center gap-2 mb-4 border-b border-current/10 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'proposals'
                ? 'bg-[#203A2A] text-white shadow-xs'
                : isNightMode
                ? 'text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'text-[#637062] hover:bg-[#E6EDE1]'
            }`}
          >
            <Vote className="w-4 h-4 text-[#E9C46A]" />
            <span>Council Proposals ({proposals.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gamification')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'gamification'
                ? 'bg-[#203A2A] text-white shadow-xs'
                : isNightMode
                ? 'text-[#A8BDA5] hover:bg-[#2A3B26]'
                : 'text-[#637062] hover:bg-[#E6EDE1]'
            }`}
          >
            <Award className="w-4 h-4 text-[#2A9D8F]" />
            <span>Symbiosis Ranks & Badges</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ml-auto ${
              activeTab === 'create'
                ? 'bg-[#588157] text-white shadow-xs'
                : isNightMode
                ? 'bg-[#2A3B26] text-[#E9C46A]'
                : 'bg-[#E6EDE1] text-[#203A2A]'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Proposal</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-4">
          {/* TAB 1: Council Proposals */}
          {activeTab === 'proposals' && (
            <div className="space-y-4">
              {/* User Voting Power Header Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26]'
                    : 'bg-white border-[#87A878]/30 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Flame className="w-5 h-5 text-[#E9C46A]" />
                  <div>
                    <span className="text-[#637062] dark:text-[#A8BDA5]">Your Mesh Voting Weight: </span>
                    <span className="font-mono font-bold text-sm text-[#588157]">
                      {user.symbiosisScore} Votes
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#2A9D8F] font-bold">
                  {tierInfo.title}
                </span>
              </div>

              {/* Proposals List */}
              {proposals.map((prop) => {
                const totalVotes = prop.votesYes + prop.votesNo + prop.votesAbstain || 1;
                const yesPercent = Math.round((prop.votesYes / totalVotes) * 100);

                return (
                  <div
                    key={prop.id}
                    className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/30 text-[#203A2A]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A]">
                            {prop.category}
                          </span>
                          <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                            By {prop.authorCallsign}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-base">{prop.title}</h3>
                      </div>

                      <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#588157]/15 text-[#588157] shrink-0">
                        +{prop.symbiosisReward} pts for voting
                      </span>
                    </div>

                    <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                      {prop.description}
                    </p>

                    {/* Progress Bar for Yes Votes */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                        <span>Approval Rating: {yesPercent}%</span>
                        <span>
                          Yes: {prop.votesYes} • No: {prop.votesNo}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex">
                        <div
                          className="bg-[#2A9D8F] h-full transition-all"
                          style={{ width: `${yesPercent}%` }}
                        />
                        <div
                          className="bg-[#E76F51] h-full transition-all"
                          style={{ width: `${100 - yesPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Voting Actions */}
                    <div className="pt-2 border-t border-current/10 flex items-center justify-between gap-2">
                      {prop.userVoted ? (
                        <div className="text-xs font-bold text-[#2A9D8F] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>You voted "{prop.userVoted.toUpperCase()}" ({user.symbiosisScore} votes cast)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => onVoteProposal(prop.id, 'yes')}
                            className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-[#2A9D8F] hover:bg-[#238378] text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Vote YES</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onVoteProposal(prop.id, 'no')}
                            className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-[#E76F51] hover:bg-[#d45d40] text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Vote NO</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onVoteProposal(prop.id, 'abstain')}
                            className={`px-3 py-1.5 rounded-xl font-medium text-xs border transition-colors cursor-pointer ${
                              isNightMode
                                ? 'bg-[#182315] text-[#A8BDA5] border-[#364E30]'
                                : 'bg-gray-100 text-gray-600 border-gray-300'
                            }`}
                          >
                            Abstain
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Gamification & Symbiosis Ranks */}
          {activeTab === 'gamification' && (
            <div className="space-y-4">
              {/* Level Progress Card */}
              <div
                className={`p-5 rounded-2xl border space-y-3 ${
                  isNightMode ? 'bg-[#121A10] border-[#364E30]' : 'bg-white border-[#87A878]/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#588157] font-bold">
                      CURRENT BIOREGIONAL TIER
                    </span>
                    <h3 className="font-display font-bold text-lg text-[#588157] dark:text-[#87A878]">
                      {tierInfo.title}
                    </h3>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-2xl font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                      {user.symbiosisScore}
                    </span>
                    <span className="text-xs text-[#637062] dark:text-[#A8BDA5]"> / {tierInfo.nextThreshold} pts</span>
                  </div>
                </div>

                <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">{tierInfo.desc}</p>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                    <span>Rank Level {tierInfo.level} Progress</span>
                    <span>{Math.round(progressPercent)}% to Next Rank</span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#588157] to-[#E9C46A] h-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievements Badges Grid */}
              <div className="space-y-2">
                <h4 className="font-display font-bold text-sm text-[#588157]">
                  Unlocked Proof-of-Mutual-Aid Badges ({badges.filter((b) => b.unlocked).length}/{badges.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {badges.map((b) => (
                    <div
                      key={b.name}
                      className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${
                        b.unlocked
                          ? isNightMode
                            ? 'bg-[#121A10] border-[#364E30]'
                            : 'bg-white border-[#87A878]/35 shadow-xs'
                          : 'opacity-50 grayscale border-dashed border-gray-300 dark:border-gray-800'
                      }`}
                    >
                      <div className="text-2xl p-2 rounded-xl bg-black/5 dark:bg-white/5 shrink-0">
                        {b.icon}
                      </div>
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1">
                          <span>{b.name}</span>
                          {b.unlocked && <Sparkles className="w-3 h-3 text-[#E9C46A]" />}
                        </div>
                        <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-tight mt-0.5">
                          {b.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Create New Proposal */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Proposal Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Establish High-Gain BLE Mesh Relay at River Crossing"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Category:
                </label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as ProposalCategory)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                >
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Ecological">Ecological</option>
                  <option value="Resource Vault">Resource Vault</option>
                  <option value="Emergency Protocol">Emergency Protocol</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Rationale & Specifications
                </label>
                <textarea
                  rows={4}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Explain why this proposal benefits the local bioregion and mesh network..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden resize-none ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!newTitle.trim()}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !newTitle.trim()
                    ? 'opacity-50 bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-[#588157] hover:bg-[#466845] text-white active:scale-98'
                }`}
              >
                <Vote className="w-4 h-4 text-[#E9C46A]" />
                <span>Submit Bioregional Proposal</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
