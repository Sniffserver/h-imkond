import React from 'react';
import { ResourceItem, Transaction } from '../types';
import { SolarpunkAvatarCanvas } from './SolarpunkAvatarCanvas';
import { ReputationPill, getReputationTier } from './ReputationPill';
import { CATEGORY_STYLES } from './CategoryFilterChips';
import { MapPin, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface ResourceCardProps {
  resource: ResourceItem;
  transaction?: Transaction;
  onViewDetails: (resource: ResourceItem) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  transaction,
  onViewDetails,
}) => {
  const style = CATEGORY_STYLES[resource.category] || CATEGORY_STYLES['Tools'];
  const tier = resource.ownerReputationTier || getReputationTier(resource.ownerCompletedExchanges || 0);

  const isPending = transaction?.status === 'pending';
  const isActive = transaction?.status === 'active';
  const isCompleted = transaction?.status === 'completed';

  return (
    <div
      id={`resource-card-${resource.id}`}
      onClick={() => onViewDetails(resource)}
      className="bg-[#F0F5EE] rounded-3xl border border-[#87A878]/35 shadow-xs hover:shadow-md hover:border-[#87A878]/60 transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer group"
    >
      <div>
        {/* Top: Category & Distance & Transaction Status */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.text}`}
          >
            {resource.category}
          </span>

          <div className="flex items-center gap-2">
            {isPending && (
              <span className="text-[10px] font-mono font-bold bg-[#E9C46A]/30 text-[#8C6207] border border-[#E9C46A] px-2 py-0.5 rounded-full">
                Pending Request
              </span>
            )}
            {isActive && (
              <span className="text-[10px] font-mono font-bold bg-[#2A9D8F]/20 text-[#165B53] border border-[#2A9D8F] px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2A9D8F] animate-pulse" />
                Active Exchange
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] font-mono font-bold bg-[#87A878]/20 text-[#344E2C] border border-[#87A878] px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#588157]" />
                Completed
              </span>
            )}

            <span className="text-[11px] font-mono text-[#637062] flex items-center gap-0.5">
              <MapPin className="w-3 h-3 text-[#87A878]" />
              {resource.distanceKm} km
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-base text-[#203A2A] group-hover:text-[#588157] transition-colors mb-1.5 line-clamp-2 leading-snug">
          {resource.title}
        </h3>

        {/* Description Snippet */}
        <p className="text-xs text-[#637062] line-clamp-2 leading-relaxed mb-3">
          {resource.description}
        </p>

        {/* Availability Badge */}
        <div className="text-[11px] text-[#588157] font-medium flex items-center gap-1.5 mb-3 bg-[#FAF6EE] px-2.5 py-1 rounded-xl border border-[#87A878]/20">
          <Clock className="w-3 h-3 text-[#87A878] shrink-0" />
          <span className="truncate">{resource.availabilityText}</span>
        </div>
      </div>

      {/* Provider Info Footer */}
      <div className="pt-3 border-t border-[#87A878]/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <SolarpunkAvatarCanvas seed={resource.avatarSeed} size={32} />
          <div className="truncate">
            <div className="text-xs font-semibold text-[#203A2A] truncate">
              {resource.ownerCallsign}
            </div>
            <ReputationPill tier={tier} size="sm" showIcon={false} />
          </div>
        </div>

        <div className="flex items-center text-xs font-semibold text-[#203A2A] group-hover:text-[#588157] gap-1 transition-colors">
          <span>Details</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
};
