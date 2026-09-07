/**
 * HÕIMU Solarpunk Field Terminal Design System Tokens
 * Defines semantic color tokens, typography scale, and spacing primitives.
 */

export const colors = {
  // Primary actions
  primary: '#007AFF',
  primaryHover: '#0056CC',

  // Emergency / SOS
  emergency: '#FF3B30',
  emergencyHover: '#CC0000',

  // Success
  success: '#34C759',

  // Warning
  warning: '#FF9500',

  // Neutral
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',

  // Solarpunk Field Accents
  solarpunk: {
    darkForest: '#203A2A',
    sageGreen: '#87A878',
    forestGreen: '#588157',
    amberGold: '#E9C46A',
    terracotta: '#E76F51',
    sandBg: '#FAF6EE',
    nightBg: '#141F12',
    nightCard: '#182315',
    nightBorder: '#364E30',
  },
} as const;

export const typography = {
  h1: { fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
  h2: { fontSize: '24px', fontWeight: '600', lineHeight: '1.3' },
  h3: { fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
  body: { fontSize: '16px', fontWeight: '400', lineHeight: '1.5' },
  caption: { fontSize: '14px', fontWeight: '400', lineHeight: '1.4' },
  button: { fontSize: '16px', fontWeight: '600', lineHeight: '1.2' },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export type ColorTokens = typeof colors;
export type TypographyTokens = typeof typography;
export type SpacingTokens = typeof spacing;
