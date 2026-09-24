/**
 * HÕIMU Peer Identity & Trust State Definitions
 */

export type TrustState =
  | 'unknown'
  | 'pairing'
  | 'verified'
  | 'trusted'
  | 'rotated'
  | 'blocked'
  | 'revoked'
  | 'expired';

export interface PeerCapabilities {
  canRelay: boolean;
  isGateway: boolean;
  hasLoRaHardware: boolean;
  hasBLEHardware: boolean;
  supportedProtocolVersions: number[];
}

export interface PeerKeyHistory {
  keyVersion: number;
  signingPublicKeyHex: string;
  encryptionPublicKeyHex: string;
  validFrom: number;
  validTo?: number;
}

export interface PeerIdentity {
  nodeId: string;
  callsign: string;
  signingPublicKey: Uint8Array;
  signingPublicKeyHex: string;
  encryptionPublicKey: Uint8Array;
  encryptionPublicKeyHex: string;
  trustState: TrustState;
  capabilities: PeerCapabilities;
  firstSeenAt: number;
  lastSeenAt: number;
  keyVersion: number;
  keyHistory?: PeerKeyHistory[];
  revokedReason?: string;
}

export interface SessionKey {
  sessionId: string;
  peerNodeId: string;
  sharedKey: Uint8Array;
  createdAt: number;
  expiresAt: number;
}
