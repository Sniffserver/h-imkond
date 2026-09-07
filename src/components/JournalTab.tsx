import React, { useState, useMemo } from 'react';
import { JournalEntry, SentimentType, MeshNode } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { SymbiosisWeeklyTrendChart } from './SymbiosisWeeklyTrendChart';
import { BookOpen, Sprout, Heart, Sparkles, TrendingUp, Filter, Calendar, Search, X, Zap } from 'lucide-react';
import { LightweightSearchIndex, SearchMatchResult } from '../utils/offlineSearchIndex';

interface JournalTabProps {
  journal: JournalEntry[];
  peers: MeshNode[];
  userSymbiosisScore: number;
  completedExchangesCount: number;
  isNightMode?: boolean;
}

export const JournalTab: React.FC<JournalTabProps> = ({
  journal,
  peers,
  userSymbiosisScore,
  completedExchangesCount,
  isNightMode = false,
}) => {
  const [sentimentFilter, setSentimentFilter] = useState<'all' | SentimentType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build lightweight in-memory full-text search index
  const searchIndex = useMemo(() => {
    const index = new LightweightSearchIndex<JournalEntry>({
      fields: [
        { name: 'partnerCallsign', weight: 4 },
        { name: 'resourceTitle', weight: 3 },
        { name: 'reflection', weight: 2 },
        { name: 'sentiment', weight: 1 },
      ],
      prefixMatch: true,
      minTokenLength: 2,
    });

    const docs = journal.map((entry) => ({
      id: String(entry.id),
      fields: {
        partnerCallsign: entry.partnerCallsign,
        resourceTitle: entry.resourceTitle || '',
        reflection: entry.reflection,
        sentiment: entry.sentiment,
      },
      data: entry,
    }));

    index.addAll(docs);
    return index;
  }, [journal]);

  // Execute full-text search when query exists
  const searchResultsMap = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const results = searchIndex.search(searchQuery.trim());
    const map = new Map<string, SearchMatchResult<JournalEntry>>();
    for (const res of results) {
      map.set(res.id, res);
    }
    return map;
  }, [searchIndex, searchQuery]);

  // Filter entries by search + sentiment
  const filteredEntries = useMemo(() => {
    let list = journal;

    if (searchResultsMap) {
      // Keep only items that matched search, in order of score
      list = journal
        .filter((entry) => searchResultsMap.has(String(entry.id)))
        .sort((a, b) => {
          const scoreA = searchResultsMap.get(String(a.id))?.score ?? 0;
          const scoreB = searchResultsMap.get(String(b.id))?.score ?? 0;
          return scoreB - scoreA;
        });
    }

    if (sentimentFilter === 'all') return list;
    return list.filter((e) => e.sentiment === sentimentFilter);
  }, [journal, searchResultsMap, sentimentFilter]);

  const sentimentCounts = useMemo(() => {
    const counts = { all: journal.length, positive: 0, growth: 0, neutral: 0 };
    journal.forEach((j) => {
      if (j.sentiment in counts) {
        counts[j.sentiment as SentimentType]++;
      }
    });
    return counts;
  }, [journal]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Intro Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#87A878]/20 text-[#203A2A] text-xs font-semibold border border-[#87A878]/30">
          <Sprout className="w-3.5 h-3.5 text-[#588157]" />
          Personal Co-Evolution Ledger
        </div>
        <h2 className="font-display font-bold text-2xl text-[#203A2A]">
          Bioregional Reflection & Gratitude
        </h2>
        <p className="text-xs text-[#588157] max-w-lg mx-auto leading-relaxed">
          A personal, local ledger capturing reflections after completed mutual aid exchanges. Each reflection deepens community ties and increases your local Symbiosis Score.
        </p>
      </div>

      {/* Summary Stat Banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#F0F5EE] p-3.5 sm:p-4 rounded-3xl border border-[#87A878]/35 text-center shadow-xs">
          <div className="text-[11px] font-medium text-[#637062] flex items-center justify-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-[#588157]" />
            Reflections
          </div>
          <div className="text-2xl font-display font-bold text-[#203A2A] mt-1">
            {journal.length}
          </div>
        </div>

        <div className="bg-[#F0F5EE] p-3.5 sm:p-4 rounded-3xl border border-[#87A878]/35 text-center shadow-xs">
          <div className="text-[11px] font-medium text-[#637062] flex items-center justify-center gap-1">
            <Sprout className="w-3.5 h-3.5 text-[#2A9D8F]" />
            Symbiosis Score
          </div>
          <div className="text-2xl font-display font-bold text-[#2A9D8F] mt-1">
            {userSymbiosisScore}
          </div>
        </div>

        <div className="bg-[#F0F5EE] p-3.5 sm:p-4 rounded-3xl border border-[#87A878]/35 text-center shadow-xs">
          <div className="text-[11px] font-medium text-[#637062] flex items-center justify-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#E76F51]" />
            Exchanges
          </div>
          <div className="text-2xl font-display font-bold text-[#588157] mt-1">
            {completedExchangesCount}
          </div>
        </div>
      </div>

      {/* SVG Weekly Symbiosis Score Trend Chart */}
      <SymbiosisWeeklyTrendChart
        currentScore={userSymbiosisScore}
        isNightMode={isNightMode}
      />

      {/* Offline Full-Text Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-[#637062] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="journal-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflections, partner callsigns, resources... (offline full-text)"
            className="w-full pl-10 pr-24 py-2.5 bg-white border border-[#87A878]/35 rounded-2xl text-xs text-[#203A2A] placeholder-[#8F9D8D] focus:outline-none focus:ring-2 focus:ring-[#87A878] shadow-2xs transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-[#637062] hover:text-[#203A2A] rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#588157] bg-[#F0F5EE] px-2 py-0.5 rounded-md border border-[#87A878]/30">
              <Zap className="w-2.5 h-2.5 text-[#E9C46A]" />
              Offline Index
            </span>
          </div>
        </div>

        {searchQuery && (
          <div className="flex items-center justify-between text-xs px-2 text-[#588157]">
            <span>
              Found <strong>{filteredEntries.length}</strong> matching{' '}
              {filteredEntries.length === 1 ? 'reflection' : 'reflections'} for "{searchQuery}"
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-[#E76F51] hover:underline cursor-pointer"
            >
              Reset search
            </button>
          </div>
        )}
      </div>

      {/* Sentiment Filter Tabs */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setSentimentFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            sentimentFilter === 'all'
              ? 'bg-[#203A2A] text-white border-[#203A2A] shadow-xs'
              : 'bg-white text-[#637062] border-[#87A878]/30 hover:border-[#87A878]'
          }`}
        >
          All ({sentimentCounts.all})
        </button>

        <button
          type="button"
          onClick={() => setSentimentFilter('positive')}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            sentimentFilter === 'positive'
              ? 'bg-[#588157] text-white border-[#588157] shadow-xs'
              : 'bg-[#F2F6F0] text-[#344E2C] border-[#87A878]/30 hover:border-[#87A878]'
          }`}
        >
          <Heart className="w-3 h-3" />
          Positive ({sentimentCounts.positive})
        </button>

        <button
          type="button"
          onClick={() => setSentimentFilter('growth')}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            sentimentFilter === 'growth'
              ? 'bg-[#E9C46A] text-[#243128] border-[#E9C46A] shadow-xs'
              : 'bg-[#FDF8EB] text-[#8C6207] border-[#E9C46A]/40 hover:border-[#E9C46A]'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          Growth ({sentimentCounts.growth})
        </button>

        <button
          type="button"
          onClick={() => setSentimentFilter('neutral')}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            sentimentFilter === 'neutral'
              ? 'bg-[#2A9D8F] text-white border-[#2A9D8F] shadow-xs'
              : 'bg-[#EBF7F5] text-[#165B53] border-[#2A9D8F]/30 hover:border-[#2A9D8F]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          Neutral ({sentimentCounts.neutral})
        </button>
      </div>

      {/* Timeline Entries */}
      {filteredEntries.length === 0 ? (
        <div className="bg-[#F0F5EE] rounded-3xl border border-[#87A878]/30 p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-[#87A878] mx-auto opacity-70" />
          <h3 className="font-display font-bold text-sm text-[#203A2A]">
            {searchQuery ? 'No reflections matched your search' : 'No reflections recorded for this filter'}
          </h3>
          <p className="text-xs text-[#637062]">
            {searchQuery
              ? 'Try using different keywords or clearing the search query.'
              : 'Complete mutual aid exchanges in the Exchange tab to grow your journal.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 px-3 py-1.5 bg-[#203A2A] text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-[#87A878]/30">
          {filteredEntries.map((entry) => {
            const dateStr = new Date(entry.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            const partnerPeer = peers.find((p) => p.callsign === entry.partnerCallsign);
            const avatarSeed = partnerPeer?.avatarSeed || `seed-${entry.partnerCallsign}`;

            const sentimentBg =
              entry.sentiment === 'positive'
                ? 'bg-[#87A878]/20 text-[#344E2C] border-[#87A878]/40'
                : entry.sentiment === 'growth'
                ? 'bg-[#E9C46A]/20 text-[#8C6207] border-[#E9C46A]/50'
                : 'bg-[#2A9D8F]/20 text-[#165B53] border-[#2A9D8F]/40';

            const matchMeta = searchResultsMap?.get(String(entry.id));

            return (
              <div key={entry.id} className="relative pl-11">
                {/* Timeline node icon */}
                <div className="absolute left-3.5 top-4 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FAF6EE] border-2 border-[#588157] flex items-center justify-center shadow-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#588157]" />
                </div>

                <div className="bg-[#F0F5EE] rounded-3xl border border-[#87A878]/35 p-5 shadow-xs hover:border-[#87A878]/60 transition-all space-y-3">
                  {/* Top: Partner & Date & Delta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#87A878]/20">
                    <div className="flex items-center gap-2.5">
                      <SolarpunkAvatarCanvas seed={avatarSeed} size={34} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-sm text-[#203A2A]">
                            Exchange with {entry.partnerCallsign}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${sentimentBg}`}
                          >
                            {entry.sentiment}
                          </span>
                          {matchMeta && (
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-[#E9C46A]/30 text-[#8C6207] rounded-md border border-[#E9C46A]/50">
                              Score: {matchMeta.score}
                            </span>
                          )}
                        </div>
                        {entry.resourceTitle && (
                          <div className="text-[11px] text-[#637062] font-medium mt-0.5">
                            Resource: <span className="text-[#203A2A] font-semibold">{entry.resourceTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#637062] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#87A878]" />
                        {dateStr}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#E76F51] bg-[#FDF1EE] border border-[#E76F51]/30 px-2 py-0.5 rounded-full">
                        +{entry.scoreDelta} Symbiosis
                      </span>
                    </div>
                  </div>

                  {/* Reflection quote */}
                  <blockquote className="text-xs text-[#203A2A] italic bg-white/80 p-3.5 rounded-2xl border border-[#87A878]/20 leading-relaxed font-sans">
                    "{entry.reflection}"
                  </blockquote>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
