import React from 'react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  tertiaryAction?: EmptyStateAction; // Used for "Continue without [feature]"
  isNightMode?: boolean;
  className?: string;
  id?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  isNightMode = false,
  className = '',
  id,
}) => {
  return (
    <div
      id={id || `empty-state-${title.toLowerCase().replace(/\s+/g, '-')}`}
      role="status"
      aria-live="polite"
      className={`p-6 sm:p-8 rounded-3xl border text-center flex flex-col items-center justify-center my-3 transition-colors duration-200 ${
        isNightMode
          ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
          : 'bg-[#FAF6EE] border-[#87A878]/30 text-[#203A2A]'
      } ${className}`}
    >
      {/* Visual Icon Badge */}
      <div className="relative mb-3.5">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs transition-transform ${
            isNightMode ? 'bg-[#2A3B26] text-[#E9C46A]' : 'bg-[#588157]/15 text-[#588157]'
          }`}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<any>, {
                className: 'w-7 h-7 text-current',
              })
            : icon}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display font-bold text-base sm:text-lg mb-1 tracking-tight text-[#203A2A] dark:text-[#F0F5EE]">
        {title}
      </h3>

      {/* Message: One sentence explaining what's happening */}
      <p className="text-xs sm:text-sm text-[#637062] dark:text-[#A8BDA5] max-w-md mb-5 leading-relaxed">
        {message}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] rounded-xl font-bold text-xs bg-[#588157] hover:bg-[#476a46] text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {primaryAction.label}
          </button>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className={`inline-flex items-center justify-center px-3.5 py-2.5 min-h-[44px] rounded-xl font-semibold text-xs transition-all active:scale-95 cursor-pointer border ${
              isNightMode
                ? 'bg-[#223120] border-[#364E30] text-[#A8BDA5] hover:text-[#F0F5EE] hover:bg-[#2A3B26]'
                : 'bg-white border-[#87A878]/40 text-[#203A2A] hover:bg-[#87A878]/10'
            }`}
          >
            {secondaryAction.label}
          </button>
        )}

        {tertiaryAction && (
          <button
            type="button"
            onClick={tertiaryAction.onClick}
            disabled={tertiaryAction.disabled}
            className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-[#637062] dark:text-[#A8BDA5] hover:underline cursor-pointer transition-colors"
          >
            {tertiaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
