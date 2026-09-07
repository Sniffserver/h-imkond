import React, { useState, useMemo } from 'react';
import { ResourceItem, ResourceCategory, CityMapData } from '../types';
import { soundFeedback } from '../services/utils/soundFeedback';
import {
  HeartHandshake,
  MapPin,
  Boxes,
  Zap,
  Wheat,
  Wrench,
  HeartPulse,
  Home,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ChevronDown,
  X,
  Compass,
  Navigation,
  CheckCircle2,
  Filter,
  Eye,
} from 'lucide-react';

export interface ResourceCluster {
  id: string;
  name: string;
  districtName?: string;
  centroid: { x: number; y: number };
  items: ResourceItem[];
  count: number;
  categories: { category: ResourceCategory; count: number }[];
  averageDistanceKm: number;
  dominantCategory: ResourceCategory;
}

interface NearbyResourcesOverlayProps {
  resources: ResourceItem[];
  selectedCity: CityMapData;
  userCoords?: { x: number; y: number };
  onSelectResource: (res: ResourceItem) => void;
  onFocusCoordinates?: (coords: { x: number; y: number }, targetScale?: number) => void;
  isNightMode?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export const CATEGORY_ICON_MAP: Record<ResourceCategory, React.ReactNode> = {
  Food: <Wheat className="w-3.5 h-3.5 text-[#588157]" />,
  Energy: <Zap className="w-3.5 h-3.5 text-[#E9C46A]" />,
  Tools: <Wrench className="w-3.5 h-3.5 text-[#2A9D8F]" />,
  Skills: <GraduationCap className="w-3.5 h-3.5 text-[#9C6644]" />,
  'Care & Housing': <Home className="w-3.5 h-3.5 text-[#4A6B82]" />,
  'Bio-Remedy': <HeartPulse className="w-3.5 h-3.5 text-[#E76F51]" />,
  Electronics: <Boxes className="w-3.5 h-3.5 text-[#637062]" />,
};

export const CATEGORY_COLOR_MAP: Record<ResourceCategory, string> = {
  Food: '#588157',
  Energy: '#E9C46A',
  Tools: '#2A9D8F',
  Skills: '#9C6644',
  'Care & Housing': '#4A6B82',
  'Bio-Remedy': '#E76F51',
  Electronics: '#2A9D8F',
};

export const NearbyResourcesOverlay: React.FC<NearbyResourcesOverlayProps> = ({
  resources,
  selectedCity,
  userCoords = { x: 0, y: 0 },
  onSelectResource,
  onFocusCoordinates,
  isNightMode = false,
  isOpen,
  onToggle,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  // 1. Filter active peer offerings (excluding requests, only available aid)
  const activeOfferings = useMemo(() => {
    return resources.filter((r) => r.isActive && r.type !== 'request');
  }, [resources]);

  // 2. Cluster active offerings spatially
  const clusters = useMemo<ResourceCluster[]>(() => {
    if (activeOfferings.length === 0) return [];

    // Ensure each offering has simulated or real coordinates
    const itemsWithCoords = activeOfferings.map((res, idx) => {
      let x = res.coordinates?.x;
      let y = res.coordinates?.y;

      if (x === undefined || y === undefined) {
        // Deterministic spatial distribution across city sectors based on id / owner
        const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
        const radius = 25 + ((idx * 23) % 45);
        x = Math.round(Math.cos(angle) * radius);
        y = Math.round(Math.sin(angle) * radius);
      }

      return {
        ...res,
        resolvedCoords: { x, y },
      };
    });

    // Spatial clustering: Group items within ~35 coordinate units
    const clusterBuckets: {
      centroid: { x: number; y: number };
      items: (ResourceItem & { resolvedCoords: { x: number; y: number } })[];
    }[] = [];

    const CLUSTER_RADIUS = 36;

    itemsWithCoords.forEach((item) => {
      let foundBucket = false;
      for (const bucket of clusterBuckets) {
        const dx = bucket.centroid.x - item.resolvedCoords.x;
        const dy = bucket.centroid.y - item.resolvedCoords.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= CLUSTER_RADIUS) {
          bucket.items.push(item);
          // Recalculate running centroid
          const totalX = bucket.items.reduce((acc, it) => acc + it.resolvedCoords.x, 0);
          const totalY = bucket.items.reduce((acc, it) => acc + it.resolvedCoords.y, 0);
          bucket.centroid = {
            x: Math.round(totalX / bucket.items.length),
            y: Math.round(totalY / bucket.items.length),
          };
          foundBucket = true;
          break;
        }
      }

      if (!foundBucket) {
        clusterBuckets.push({
          centroid: item.resolvedCoords,
          items: [item],
        });
      }
    });

    // Name clusters based on closest city district / landmarks or geography
    const districts = selectedCity.districts || [
      { name: 'Kesklinn Commons', x: 0, y: 0 },
      { name: 'Supilinn Emajõe Hub', x: -25, y: -20 },
      { name: 'Toomemägi Forest Hub', x: -15, y: 20 },
      { name: 'Karlova Craft Sector', x: 30, y: 35 },
      { name: 'Annelinn Microgrid Commons', x: 45, y: -25 },
    ];

    return clusterBuckets.map((bucket, index) => {
      // Find closest district name
      let closestDistrict = districts[0]?.name || 'Bioregional Commons';
      let minDist = Infinity;

      districts.forEach((d) => {
        const dx = d.x - bucket.centroid.x;
        const dy = d.y - bucket.centroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestDistrict = d.name;
        }
      });

      // Category breakdown
      const catCountMap = new Map<ResourceCategory, number>();
      bucket.items.forEach((it) => {
        catCountMap.set(it.category, (catCountMap.get(it.category) || 0) + 1);
      });

      const categories = Array.from(catCountMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      const dominantCategory: ResourceCategory = categories[0]?.category || 'Tools';

      // Distance in km
      const avgDist =
        bucket.items.reduce((acc, it) => acc + (it.distanceKm || 0.8), 0) / bucket.items.length;

      return {
        id: `cluster-${index}-${closestDistrict.toLowerCase().replace(/\s+/g, '-')}`,
        name: `${closestDistrict} Aid Cluster`,
        districtName: closestDistrict,
        centroid: bucket.centroid,
        items: bucket.items,
        count: bucket.items.length,
        categories,
        averageDistanceKm: parseFloat(avgDist.toFixed(1)),
        dominantCategory,
      };
    });
  }, [activeOfferings, selectedCity]);

  // Filter clusters by selected category
  const filteredClusters = useMemo(() => {
    if (selectedCategoryFilter === 'all') return clusters;
    return clusters.filter((c) =>
      c.categories.some((cat) => cat.category.toLowerCase() === selectedCategoryFilter.toLowerCase())
    );
  }, [clusters, selectedCategoryFilter]);

  const totalAidCapacity = activeOfferings.length;

  const handleFocusCluster = (cluster: ResourceCluster) => {
    soundFeedback.playClick();
    if (onFocusCoordinates) {
      onFocusCoordinates(cluster.centroid, 2.2);
    }
  };

  return (
    <>
      {/* Floating Toggle Pill On Map Toolbar */}
      <button
        type="button"
        onClick={() => {
          soundFeedback.playClick();
          onToggle();
        }}
        id="btn-nearby-resources-overlay"
        title="Nearby Resources Overlay (Kuva läheduses asuvate ressursside klastrid ja kogukonnaabi)"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-md cursor-pointer ${
          isOpen
            ? 'bg-[#2A9D8F] border-[#2A9D8F] text-white shadow-[#2A9D8F]/30 shadow-lg'
            : isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE] hover:border-[#2A9D8F]'
            : 'bg-white border-[#87A878]/50 text-[#203A2A] hover:bg-[#FAF6EE]'
        }`}
      >
        <HeartHandshake className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-[#2A9D8F]'}`} />
        <span>Nearby Aid Clusters</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            isOpen
              ? 'bg-white/20 text-white'
              : 'bg-[#2A9D8F]/15 text-[#2A9D8F] dark:text-[#87A878]'
          }`}
        >
          {clusters.length}
        </span>
      </button>

      {/* Interactive Floating Overlay Panel on Map */}
      {isOpen && (
        <div
          className={`absolute top-16 left-4 sm:left-6 z-30 w-84 sm:w-96 max-w-[calc(100vw-2rem)] rounded-3xl border shadow-2xl backdrop-blur-md transition-all duration-200 overflow-hidden ${
            isNightMode
              ? 'bg-[#141F12]/95 border-[#364E30] text-[#F0F5EE] shadow-black/50'
              : 'bg-[#FAF6EE]/95 border-[#87A878]/40 text-[#203A2A] shadow-xl'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-current/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/30 flex items-center justify-center text-[#2A9D8F]">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm flex items-center gap-1.5">
                  <span>Community Aid Clusters</span>
                  <span className="text-[10px] font-mono font-normal px-2 py-0.2 rounded-full bg-[#588157]/20 text-[#588157] dark:text-[#87A878]">
                    {selectedCity.cityName}
                  </span>
                </h3>
                <p className="text-[11px] text-[#588157] font-mono">
                  {totalAidCapacity} active peer offerings across {clusters.length} geographic hubs
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[#637062] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="p-2.5 border-b border-current/10 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-[#2A9D8F] text-white shadow-xs'
                  : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              All ({clusters.length})
            </button>
            {(['Food', 'Energy', 'Tools', 'Skills', 'Care & Housing', 'Bio-Remedy', 'Electronics'] as ResourceCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat.toLowerCase())}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategoryFilter === cat.toLowerCase()
                    ? 'bg-[#2A9D8F] text-white shadow-xs'
                    : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {CATEGORY_ICON_MAP[cat]}
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Clusters List */}
          <div className="p-3 space-y-2.5 max-h-96 overflow-y-auto">
            {filteredClusters.length === 0 ? (
              <div className="p-6 text-center text-[#637062] dark:text-[#A8BDA5] space-y-1">
                <Boxes className="w-6 h-6 mx-auto opacity-50" />
                <p className="text-xs font-semibold">No aid clusters in this category</p>
                <p className="text-[10px]">Select another category filter or add a community offering.</p>
              </div>
            ) : (
              filteredClusters.map((cluster) => {
                const isExpanded = expandedClusterId === cluster.id;
                const dominantColor = CATEGORY_COLOR_MAP[cluster.dominantCategory] || '#2A9D8F';

                return (
                  <div
                    key={cluster.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isNightMode
                        ? 'bg-[#182315] border-[#2A3B26] hover:border-[#364E30]'
                        : 'bg-white border-[#87A878]/30 hover:border-[#87A878]/60 shadow-xs'
                    }`}
                  >
                    {/* Cluster Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-xs"
                          style={{ backgroundColor: dominantColor }}
                        >
                          {cluster.count}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-display font-bold text-xs truncate">
                            {cluster.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                            <span className="flex items-center gap-0.5">
                              <Compass className="w-3 h-3 text-[#E76F51]" />
                              {cluster.averageDistanceKm} km away
                            </span>
                            <span>•</span>
                            <span>{cluster.count} offerings</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Focus on map */}
                        <button
                          type="button"
                          onClick={() => handleFocusCluster(cluster)}
                          title="Focus map on this community aid cluster"
                          className="p-1.5 rounded-lg text-[#2A9D8F] hover:bg-[#2A9D8F]/15 transition-colors cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </button>

                        {/* Expand items */}
                        <button
                          type="button"
                          onClick={() => {
                            soundFeedback.playClick();
                            setExpandedClusterId(isExpanded ? null : cluster.id);
                          }}
                          className="p-1.5 rounded-lg text-[#637062] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Category Breakdown Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-current/10">
                      {cluster.categories.map((cat) => (
                        <span
                          key={cat.category}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-black/5 dark:bg-white/5 border border-current/10"
                        >
                          {CATEGORY_ICON_MAP[cat.category]}
                          <span>
                            {cat.category} ({cat.count})
                          </span>
                        </span>
                      ))}
                    </div>

                    {/* Expanded Offerings Details */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2 border-t border-current/10 space-y-1.5 animate-in fade-in duration-150">
                        <span className="text-[10px] font-mono font-bold text-[#588157] block">
                          COMMUNITY AID IN THIS SECTOR:
                        </span>
                        <div className="space-y-1.5">
                          {cluster.items.map((item) => (
                            <div
                              key={item.id}
                              className={`p-2 rounded-xl flex items-center justify-between gap-2 text-xs border ${
                                isNightMode
                                  ? 'bg-[#121A10] border-[#223120]'
                                  : 'bg-[#FAF6EE] border-[#87A878]/25'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-[11px] truncate block">
                                  {item.title}
                                </span>
                                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                                  Steward: {item.ownerCallsign} • {item.availabilityText || 'Available'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  soundFeedback.playClick();
                                  onSelectResource(item);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#2A9D8F] hover:bg-[#238277] text-white text-[10px] font-bold shrink-0 cursor-pointer"
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with summary note */}
          <div className="p-3 border-t border-current/10 text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5] flex items-center justify-between bg-black/5 dark:bg-white/5">
            <span className="flex items-center gap-1 text-[#2A9D8F]">
              <Sparkles className="w-3 h-3" /> Mutual Aid Clustering Active
            </span>
            <span>Click navigation arrow to zoom</span>
          </div>
        </div>
      )}
    </>
  );
};
export default NearbyResourcesOverlay;
