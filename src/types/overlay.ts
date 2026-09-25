/**
 * HÕIMU App Overlay Router State
 * Replaces independent modal booleans with a clean discriminated union.
 */

export type AppOverlay =
  | { type: 'none' }
  | { type: 'quick-add' }
  | { type: 'wishlist' }
  | { type: 'peer'; peerId: string }
  | { type: 'reputation'; peerId: string }
  | { type: 'resource'; resourceId: string }
  | { type: 'reflection'; resourceId: string }
  | { type: 'chat'; peerId: string }
  | { type: 'settings' }
  | { type: 'diagnostics' }
  | { type: 'backup' }
  | { type: 'skills' }
  | { type: 'trust' }
  | { type: 'dao' }
  | { type: 'calendar' }
  | { type: 'manual' }
  | { type: 'command-palette' }
  | { type: 'shortcuts' }
  | { type: 'landing' };
