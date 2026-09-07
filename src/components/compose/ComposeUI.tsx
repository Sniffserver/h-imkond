import React from 'react';

/**
 * Android Jetpack Compose UI Primitives mapped to React & Tailwind CSS
 * Gives the exact declarative feel of Compose while rendering responsive, accessible web elements.
 */

// ==========================================
// 1. Column (Compose Column Layout)
// ==========================================
export interface ColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  verticalArrangement?: 'top' | 'center' | 'bottom' | 'space-between' | 'space-around';
  horizontalAlignment?: 'start' | 'center' | 'end' | 'stretch';
  gap?: number | string;
  children?: React.ReactNode;
}

export const Column: React.FC<ColumnProps> = ({
  verticalArrangement = 'top',
  horizontalAlignment = 'stretch',
  gap = 3,
  className = '',
  children,
  ...props
}) => {
  const justifyClass = {
    top: 'justify-start',
    center: 'justify-center',
    bottom: 'justify-end',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
  }[verticalArrangement];

  const itemsClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[horizontalAlignment];

  const gapClass = typeof gap === 'number' ? `gap-${gap}` : '';

  return (
    <div
      className={`flex flex-col ${justifyClass} ${itemsClass} ${gapClass} ${className}`}
      style={typeof gap === 'string' ? { gap } : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

// ==========================================
// 2. Row (Compose Row Layout)
// ==========================================
export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  horizontalArrangement?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  verticalAlignment?: 'top' | 'center' | 'bottom';
  gap?: number | string;
  children?: React.ReactNode;
}

export const Row: React.FC<RowProps> = ({
  horizontalArrangement = 'start',
  verticalAlignment = 'center',
  gap = 2,
  className = '',
  children,
  ...props
}) => {
  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
  }[horizontalArrangement];

  const itemsClass = {
    top: 'items-start',
    center: 'items-center',
    bottom: 'items-end',
  }[verticalAlignment];

  const gapClass = typeof gap === 'number' ? `gap-${gap}` : '';

  return (
    <div
      className={`flex flex-row ${justifyClass} ${itemsClass} ${gapClass} ${className}`}
      style={typeof gap === 'string' ? { gap } : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

// ==========================================
// 3. Surface (Compose Material 3 Surface)
// ==========================================
export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: string;
  shape?: 'rounded' | 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl' | 'full';
  border?: boolean;
  borderColor?: string;
  tonalElevation?: number;
  children?: React.ReactNode;
}

export const Surface: React.FC<SurfaceProps> = ({
  shape = 'rounded-2xl',
  border = true,
  borderColor = 'border-[#87A878]/30',
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`${shape} ${border ? `border ${borderColor}` : ''} bg-[#FAF6EE] dark:bg-[#182315] shadow-xs ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// ==========================================
// 4. Text (Compose Typography Component)
// ==========================================
export type ComposeTextStyle =
  | 'displayLarge'
  | 'headlineMedium'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall';

export interface ComposeTextProps extends Omit<React.HTMLAttributes<HTMLParagraphElement>, 'style'> {
  style?: ComposeTextStyle;
  color?: string;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  children?: React.ReactNode;
}

export const Text: React.FC<ComposeTextProps> = ({
  style = 'bodyMedium',
  color = '',
  weight,
  className = '',
  children,
  ...props
}) => {
  const styleClasses: Record<ComposeTextStyle, string> = {
    displayLarge: 'font-display text-2xl sm:text-3xl font-bold tracking-tight',
    headlineMedium: 'font-display text-xl sm:text-2xl font-bold',
    titleLarge: 'font-display text-lg sm:text-xl font-bold',
    titleMedium: 'font-display text-base font-semibold',
    titleSmall: 'font-display text-sm font-semibold',
    bodyLarge: 'text-base leading-relaxed',
    bodyMedium: 'text-sm leading-normal',
    bodySmall: 'text-xs leading-normal',
    labelLarge: 'text-sm font-semibold tracking-wide',
    labelMedium: 'text-xs font-semibold tracking-wide',
    labelSmall: 'text-[11px] font-medium tracking-wider uppercase',
  };

  const weightClass = weight
    ? {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
      }[weight]
    : '';

  return (
    <p
      className={`${styleClasses[style]} ${weightClass} ${color || 'text-[#203A2A] dark:text-[#F0F5EE]'} ${className}`}
      {...props}
    >
      {children}
    </p>
  );
};

// ==========================================
// 5. OutlinedTextField (Compose Input Field)
// ==========================================
export interface OutlinedTextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  supportingText?: string;
  isError?: boolean;
  errorMessage?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
}

export const OutlinedTextField: React.FC<OutlinedTextFieldProps> = ({
  value,
  onValueChange,
  label,
  placeholder,
  supportingText,
  isError = false,
  errorMessage,
  leadingIcon,
  trailingIcon,
  multiline = false,
  rows = 3,
  className = '',
  id,
  ...props
}) => {
  const borderClass = isError
    ? 'border-[#E76F51] focus:ring-[#E76F51]'
    : 'border-[#87A878]/40 focus:border-[#588157] focus:ring-1 focus:ring-[#588157]';

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className={`text-xs font-semibold ${
            isError ? 'text-[#E76F51]' : 'text-[#637062] dark:text-[#A8BDA5]'
          }`}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {leadingIcon && (
          <div className="absolute left-3 text-[#588157] pointer-events-none">
            {leadingIcon}
          </div>
        )}

        {multiline ? (
          <textarea
            id={id}
            rows={rows}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-2xl bg-white dark:bg-[#1F2C1D] px-3.5 py-2.5 text-sm text-[#203A2A] dark:text-[#F0F5EE] border ${borderClass} outline-none transition-all placeholder:text-[#637062]/50 ${
              leadingIcon ? 'pl-9' : ''
            } ${trailingIcon ? 'pr-9' : ''}`}
          />
        ) : (
          <input
            id={id}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-2xl bg-white dark:bg-[#1F2C1D] px-3.5 py-2.5 text-sm text-[#203A2A] dark:text-[#F0F5EE] border ${borderClass} outline-none transition-all placeholder:text-[#637062]/50 ${
              leadingIcon ? 'pl-9' : ''
            } ${trailingIcon ? 'pr-9' : ''}`}
            {...props}
          />
        )}

        {trailingIcon && (
          <div className="absolute right-3 text-[#637062] dark:text-[#87A878]">
            {trailingIcon}
          </div>
        )}
      </div>

      {(isError && errorMessage) ? (
        <span className="text-[11px] text-[#E76F51] font-medium">{errorMessage}</span>
      ) : supportingText ? (
        <span className="text-[11px] text-[#637062] dark:text-[#87A878]">{supportingText}</span>
      ) : null}
    </div>
  );
};

// ==========================================
// 6. Button / OutlinedButton / TextButton (Compose Buttons)
// ==========================================
export interface ComposeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text';
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ComposeButtonProps> = ({
  variant = 'filled',
  leadingIcon,
  trailingIcon,
  className = '',
  disabled = false,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer active:scale-98 disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses = {
    filled: 'bg-[#203A2A] dark:bg-[#588157] text-white hover:bg-[#16271c] dark:hover:bg-[#6b9c6a] shadow-sm',
    outlined:
      'bg-transparent border border-[#87A878]/50 text-[#203A2A] dark:text-[#F0F5EE] hover:bg-[#87A878]/15',
    text: 'bg-transparent text-[#588157] dark:text-[#87A878] hover:bg-[#588157]/10 p-2',
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
};

export const OutlinedButton: React.FC<Omit<ComposeButtonProps, 'variant'>> = (props) => (
  <Button variant="outlined" {...props} />
);

export const TextButton: React.FC<Omit<ComposeButtonProps, 'variant'>> = (props) => (
  <Button variant="text" {...props} />
);

// ==========================================
// 7. FilterChip (Compose Chip)
// ==========================================
export interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  leadingIcon?: React.ReactNode;
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  selected,
  onClick,
  label,
  leadingIcon,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
        selected
          ? 'bg-[#203A2A] dark:bg-[#588157] text-white shadow-xs'
          : 'bg-white/80 dark:bg-[#1F2C1D] text-[#203A2A] dark:text-[#E2E8F0] border border-[#87A878]/30 hover:border-[#588157]'
      } ${className}`}
    >
      {leadingIcon}
      <span>{label}</span>
    </button>
  );
};

// ==========================================
// 8. Switch (Compose Switch Toggle)
// ==========================================
export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  id,
}) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
        checked ? 'bg-[#588157]' : 'bg-[#637062]/30 dark:bg-[#364E30]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

// ==========================================
// 9. HorizontalDivider (Compose HorizontalDivider)
// ==========================================
export const HorizontalDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <hr className={`border-0 h-px bg-[#87A878]/25 dark:bg-[#364E30] my-2 ${className}`} />
);

// ==========================================
// 10. Spacer (Compose Spacer)
// ==========================================
export const Spacer: React.FC<{ size?: number }> = ({ size = 2 }) => {
  return <div style={{ height: `${size * 4}px`, width: `${size * 4}px` }} />;
};
