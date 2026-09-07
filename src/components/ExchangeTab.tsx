import React, { useState, useMemo } from 'react';
import { ResourceItem, Transaction, ResourceCategory, MeshNode } from '../types';
import { CategoryFilterChips } from './CategoryFilterChips';
import { ResourceCard } from './ResourceCard';
import { SymbiosisScoreBadge } from './SymbiosisScoreBadge';
import { ExchangeEmptyState } from './EmptyStates/ExchangeEmptyState';
import { Search, SlidersHorizontal, PackageOpen, Plus, Landmark, BellRing, QrCode, Zap, X } from 'lucide-react';
import { LightweightSearchIndex, SearchMatchResult } from '../utils/offlineSearchIndex';

interface ExchangeTabProps {
  resources: ResourceItem[];
  transactions: Transaction[];
  peers: MeshNode[];
  userSymbiosisScore: number;
  onViewResourceDetails: (resource: ResourceItem) => void;
  onOpenCreateOffering?: () => void;
  onOpenWishlist?: () => void;
  onOpenDaoModal?: () => void;
  onScanQr?: () => void; // Added scan callback
  isNightMode?: boolean;
}

export const ExchangeTab: React.FC<ExchangeTabProps> = ({
  resources,
  transactions,
  peers,
  userSymbiosisScore,
  onViewResourceDetails,
  onOpenCreateOffering,
  onOpenWishlist,
  onOpenDaoModal,
  onScanQr, // Added scan callback
  isNightMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'relevance' | 'nearest' | 'newest' | 'trust'>('nearest');

  // Build in-memory offline full-text search index for resources
  const resourceSearchIndex = useMemo(() => {
    const index = new LightweightSearchIndex<ResourceItem>({
      fields: [
        { name: 'title', weight: 5 },
        { name: 'category', weight: 3 },
        { name: 'ownerCallsign', weight: 3 },
        { name: 'description', weight: 2 },
      ],
      prefixMatch: true,
      minTokenLength: 2,
    });

    const docs = resources.map((item) => ({
      id: item.id,
      fields: {
        title: item.title,
        category: item.category,
        ownerCallsign: item.ownerCallsign,
        description: item.description,
      },
      data: item,
    }));

    index.addAll(docs);
    return index;
  }, [resources]);

  // Execute full-text search when query exists
  const searchResultsMap = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const results = resourceSearchIndex.search(searchQuery.trim());
    const map = new Map<string, SearchMatchResult<ResourceItem>>();
    for (const r of results) {
      map.set(r.id, r);
    }
    return map;
  }, [resourceSearchIndex, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<ResourceCategory | 'ALL', number> = {
      ALL: resources.length,
      Energy: 0,
      Tools: 0,
      Skills: 0,
      Food: 0,
      'Care & Housing': 0,
      'Bio-Remedy': 0,
      'Electronics': 0,
    };
    resources.forEach((r) => {
      if (counts[r.category] !== undefined) {
        counts[r.category]++;
      }
    });
    return counts;
  }, [resources]);

  // Filter and Sort Resources
  const filteredAndSortedResources = useMemo(() => {
    let result = resources.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      // Search index match filter
      if (searchResultsMap && !searchResultsMap.has(item.id)) {
        return false;
      }
      return true;
    });

    // Sorting
    const effectiveSort = searchQuery.trim() && sortBy === 'nearest' ? 'relevance' : sortBy;

    result.sort((a, b) => {
      if (effectiveSort === 'relevance' && searchResultsMap) {
        const scoreA = searchResultsMap.get(a.id)?.score ?? 0;
        const scoreB = searchResultsMap.get(b.id)?.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      if (effectiveSort === 'nearest') {
        return a.distanceKm - b.distanceKm;
      }
      if (effectiveSort === 'newest') {
        return b.createdAt - a.createdAt;
      }
      if (effectiveSort === 'trust') {
        const peerA = peers.find((p) => p.id === a.ownerId);
        const peerB = peers.find((p) => p.id === b.ownerId);
        const scoreA = peerA?.trustScore || 50;
        const scoreB = peerB?.trustScore || 50;
        return scoreB - scoreA;
      }
      return 0;
    });

    return result;
  }, [resources, selectedCategory, searchResultsMap, searchQuery, sortBy, peers]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-[#203A2A]">
            Bioregional Mutual Aid Exchange
          </h2>
          <p className="text-xs text-[#588157]">
            Post-scarcity circular sharing of energy hardware, durable tools, regenerative skills, and harvests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenWishlist && (
            <button
              type="button"
              onClick={onOpenWishlist}
              className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                isNightMode
                  ? 'bg-[#182315] text-[#2A9D8F] border-[#364E30] hover:bg-[#2A3B26]'
                  : 'bg-white text-[#2A9D8F] border-[#2A9D8F]/30 hover:bg-[#F0F5EE]'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Wishlist Alerts</span>
            </button>
          )}

          {onOpenDaoModal && (
            <button
              type="button"
              onClick={onOpenDaoModal}
              className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                isNightMode
                  ? 'bg-[#182315] text-[#E9C46A] border-[#364E30] hover:bg-[#2A3B26]'
                  : 'bg-white text-[#8C6207] border-[#E9C46A]/50 hover:bg-[#FAF6EE]'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>DAO Council</span>
            </button>
          )}

          {onScanQr && (
            <button
              type="button"
              onClick={onScanQr}
              className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                isNightMode
                  ? 'bg-[#182315] text-[#2A9D8F] border-[#364E30] hover:bg-[#2A3B26]'
                  : 'bg-white text-[#2A9D8F] border-[#2A9D8F]/30 hover:bg-[#FAF6EE]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>Scan Sync QR</span>
            </button>
          )}

          <SymbiosisScoreBadge score={userSymbiosisScore} />
        </div>
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input with Offline Index */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7C8C77] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="resource-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Full-text search resources, tools, skills, or callsigns (offline indexed)..."
            className="w-full pl-10 pr-24 py-2.5 bg-white border border-[#87A878]/35 rounded-2xl text-xs text-[#203A2A] placeholder-[#8F9D8D] focus:outline-none focus:ring-2 focus:ring-[#87A878] shadow-2xs transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-[#7C8C77] hover:text-[#203A2A] rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#588157] bg-[#F0F5EE] px-2 py-0.5 rounded-md border border-[#87A878]/30">
              <Zap className="w-2.5 h-2.5 text-[#E9C46A]" />
              Offline
            </span>
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-[#87A878]/35 shrink-0 text-xs shadow-2xs">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#588157]" />
          <span className="text-[#637062] font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'nearest' | 'newest' | 'trust')}
            className="bg-transparent text-xs font-semibold text-[#203A2A] focus:outline-none cursor-pointer"
          >
            {searchQuery.trim() && <option value="relevance">Search Relevance</option>}
            <option value="nearest">Nearest (RF Distance)</option>
            <option value="newest">Newest Listed</option>
            <option value="trust">Peer Trust Index</option>
          </select>
        </div>
      </div>

      {/* Active Search Summary */}
      {searchQuery.trim() && (
        <div className="flex items-center justify-between text-xs px-2 -mt-3 text-[#588157]">
          <span>
            Offline index matched <strong>{filteredAndSortedResources.length}</strong> of{' '}
            <strong>{resources.length}</strong> resources for "{searchQuery}"
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-[#E76F51] hover:underline cursor-pointer"
          >
            Reset query
          </button>
        </div>
      )}

      {/* Category Filter Chips */}
      <CategoryFilterChips
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categoryCounts={categoryCounts}
      />

      {/* Resources Grid or Empty State */}
      {resources.length === 0 ? (
        <ExchangeEmptyState
          onOpenCreateOffering={onOpenCreateOffering}
          onOpenWishlist={onOpenWishlist}
          isNightMode={isNightMode}
        />
      ) : filteredAndSortedResources.length === 0 ? (
        <div className="bg-[#F0F5EE] rounded-3xl border border-[#87A878]/30 p-10 text-center space-y-2">
          <PackageOpen className="w-10 h-10 text-[#87A878] mx-auto opacity-75" />
          <h3 className="font-display font-bold text-base text-[#203A2A]">
            No resources match your query
          </h3>
          <p className="text-xs text-[#637062] max-w-sm mx-auto">
            Try adjusting your search terms or selecting a different bioregional category.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
            }}
            className="mt-2 px-4 py-2 bg-white border border-[#87A878]/40 text-[#203A2A] rounded-xl text-xs font-semibold hover:bg-[#FAF6EE]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedResources.map((resource) => {
            // Find any active or pending transaction for this resource
            const tx = transactions.find((t) => t.resourceId === resource.id);

            return (
              <ResourceCard
                key={resource.id}
                resource={resource}
                transaction={tx}
                onViewDetails={onViewResourceDetails}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
