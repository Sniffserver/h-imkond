import React from 'react';

interface MessageSkeletonProps {
  isNightMode?: boolean;
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ isNightMode = false }) => {
  return (
    <div
      role="status"
      aria-label="Loading chat messages"
      className="space-y-3 animate-pulse p-2"
    >
      <div className="flex justify-start">
        <div
          className={`p-3.5 rounded-2xl rounded-tl-xs max-w-[75%] space-y-2 ${
            isNightMode ? 'bg-[#2A3B26]' : 'bg-[#87A878]/20'
          }`}
        >
          <div className="h-3 w-20 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-4 w-48 rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>

      <div className="flex justify-end">
        <div
          className={`p-3.5 rounded-2xl rounded-tr-xs max-w-[75%] space-y-2 ${
            isNightMode ? 'bg-[#364E30]' : 'bg-[#588157]/30'
          }`}
        >
          <div className="h-3 w-16 rounded bg-black/10 dark:bg-white/10 ml-auto" />
          <div className="h-4 w-56 rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>

      <div className="flex justify-start">
        <div
          className={`p-3.5 rounded-2xl rounded-tl-xs max-w-[75%] space-y-2 ${
            isNightMode ? 'bg-[#2A3B26]' : 'bg-[#87A878]/20'
          }`}
        >
          <div className="h-3 w-24 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-4 w-36 rounded bg-black/10 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
};
