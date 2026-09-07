import React from 'react';

interface PeerListSkeletonProps {
  count?: number;
  isNightMode?: boolean;
}

export const PeerListSkeleton: React.FC<PeerListSkeletonProps> = ({
  count = 3,
  isNightMode = false,
}) => {
  return (
    <div
      role="status"
      aria-label="Loading peer radar list"
      className="space-y-3 animate-pulse my-2"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            isNightMode
              ? 'bg-[#182315] border-[#364E30]'
              : 'bg-[#FAF6EE] border-[#87A878]/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl ${
                isNightMode ? 'bg-[#2A3B26]' : 'bg-[#87A878]/20'
              }`}
            />
            <div className="space-y-2">
              <div
                className={`h-4 w-28 rounded-md ${
                  isNightMode ? 'bg-[#2A3B26]' : 'bg-[#87A878]/30'
                }`}
              />
              <div
                className={`h-3 w-40 rounded-md ${
                  isNightMode ? 'bg-[#223120]' : 'bg-[#87A878]/15'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`h-6 w-14 rounded-full ${
                isNightMode ? 'bg-[#2A3B26]' : 'bg-[#87A878]/25'
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
