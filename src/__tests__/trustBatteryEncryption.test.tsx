import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeerTrustBadge, getExchangeTrustConfig } from '../components/PeerTrustBadge';
import { PeerTrustScoreIndicator } from '../components/PeerTrustScoreIndicator';
import { calculateTrustScore } from '../utils/trustScoreCalculator';
import {
  backgroundSyncAdjuster,
  STANDARD_BEACON_INTERVAL_MS,
  LOW_BATTERY_BEACON_INTERVAL_MS,
  CRITICAL_BATTERY_BEACON_INTERVAL_MS,
  LOW_BATTERY_THRESHOLD_PERCENT,
} from '../services/mesh/backgroundSyncAdjuster';
import { BackgroundSyncAdjusterCard } from '../components/BackgroundSyncAdjusterCard';
import { getMeshSyncInterval } from '../services/mesh/meshSync';
import {
  encryptWithWebCrypto,
  decryptWithWebCrypto,
  isWebCryptoPayload,
} from '../utils/webCrypto';
import {
  setSecureLocalStorage,
  getSecureLocalStorage,
  setSecureLocalStorageAsync,
  getSecureLocalStorageAsync,
  clearSecureMemoryCache,
} from '../utils/localStorageValidator';
import { UserProfile } from '../types';

describe('Feature 1: Peer List Trust Badge (Exchange Frequency)', () => {
  it('calculates proper trust tier configurations based on peer exchange count', () => {
    const zeroTrades = getExchangeTrustConfig(0);
    expect(zeroTrades.tierName).toBe('New Kin');
    expect(zeroTrades.shortLabel).toBe('0 trades');

    const oneTrade = getExchangeTrustConfig(1);
    expect(oneTrade.tierName).toBe('Emerging Peer');
    expect(oneTrade.shortLabel).toBe('1 trade');

    const fiveTrades = getExchangeTrustConfig(5);
    expect(fiveTrades.tierName).toBe('Proven Partner');
    expect(fiveTrades.shortLabel).toBe('5 trades');

    const tenTrades = getExchangeTrustConfig(10);
    expect(tenTrades.tierName).toBe('Active Exchanger');
    expect(tenTrades.shortLabel).toBe('10 trades');

    const twentyTrades = getExchangeTrustConfig(22);
    expect(twentyTrades.tierName).toBe('Champion Exchanger');
    expect(twentyTrades.shortLabel).toBe('22 trades');
  });

  it('renders visual PeerTrustBadge with proper attributes and handles clicks', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <PeerTrustBadge
        completedExchanges={12}
        peerId="node-koidu-12"
        size="sm"
        onClick={handleClick}
      />
    );

    const badge = screen.getByRole('button');
    expect(badge).toBeDefined();
    expect(badge.id).toBe('peer-trust-badge-node-koidu-12');
    expect(badge.textContent).toContain('12 trades');

    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calculates comprehensive trust scores based on exchanges and endorsements', () => {
    // 0 exchanges -> Baseline New Kin
    const baseNew = calculateTrustScore(0, 0);
    expect(baseNew.score).toBe(30);
    expect(baseNew.tier).toBe('New Kin');

    // 15 exchanges + 5 endorsements -> Active Kin
    const activeKin = calculateTrustScore(15, 5);
    expect(activeKin.score).toBeGreaterThanOrEqual(55);
    expect(activeKin.baseScore).toBe(30);
    expect(activeKin.exchangeScore).toBe(19); // 15 * 1.25 = 18.75 -> 19
    expect(activeKin.endorsementScore).toBe(13); // 5 * 2.5 = 12.5 -> 13
    expect(activeKin.score).toBe(62);

    // 50 exchanges + 15 endorsements -> Sovereign Steward
    const steward = calculateTrustScore(50, 15);
    expect(steward.score).toBeGreaterThanOrEqual(90);
    expect(steward.tier).toBe('Sovereign Steward');
  });

  it('renders interactive PeerTrustScoreIndicator with micro progress bar', () => {
    const handleScoreClick = vi.fn();
    render(
      <PeerTrustScoreIndicator
        completedExchanges={38}
        endorsementsCount={12}
        peerId="peer-test-88"
        callsign="KOIDU-88"
        size="sm"
        onClick={handleScoreClick}
      />
    );

    const scoreIndicator = screen.getByRole('button', {
      name: /Trust Score/i,
    });
    expect(scoreIndicator).toBeDefined();
    expect(scoreIndicator.textContent).toContain('Trust');
    expect(scoreIndicator.id).toBe('peer-trust-score-indicator-peer-test-88');

    fireEvent.click(scoreIndicator);
    expect(handleScoreClick).toHaveBeenCalledTimes(1);
  });
});

describe('Feature 2: Battery-Aware Sync Interval Adjuster (<15% Battery)', () => {
  beforeEach(() => {
    backgroundSyncAdjuster.resetToAuto();
  });

  afterEach(() => {
    backgroundSyncAdjuster.resetToAuto();
  });

  it('maintains standard 8s sync frequency when battery is >= 15%', () => {
    backgroundSyncAdjuster.updateBatteryLevel(75, false);
    const state = backgroundSyncAdjuster.getState();

    expect(state.isLowBattery).toBe(false);
    expect(state.currentIntervalMs).toBe(STANDARD_BEACON_INTERVAL_MS);
    expect(getMeshSyncInterval()).toBe(STANDARD_BEACON_INTERVAL_MS);
    expect(state.reductionPercentage).toBe(0);
  });

  it('throttles sync interval to 45s when battery enters low battery state (< 15%)', () => {
    backgroundSyncAdjuster.updateBatteryLevel(14, false);
    const state = backgroundSyncAdjuster.getState();

    expect(state.isLowBattery).toBe(true);
    expect(state.currentIntervalMs).toBe(LOW_BATTERY_BEACON_INTERVAL_MS);
    expect(getMeshSyncInterval()).toBe(LOW_BATTERY_BEACON_INTERVAL_MS);
    expect(state.reductionPercentage).toBeGreaterThan(70);
  });

  it('switches to critical conservation (90s) when battery drops below 5%', () => {
    backgroundSyncAdjuster.updateBatteryLevel(4, false);
    const state = backgroundSyncAdjuster.getState();

    expect(state.isCriticalBattery).toBe(true);
    expect(state.currentIntervalMs).toBe(CRITICAL_BATTERY_BEACON_INTERVAL_MS);
    expect(getMeshSyncInterval()).toBe(CRITICAL_BATTERY_BEACON_INTERVAL_MS);
  });

  it('restores standard frequency when battery recovers to >= 15%', () => {
    backgroundSyncAdjuster.updateBatteryLevel(10, false);
    expect(backgroundSyncAdjuster.getState().isLowBattery).toBe(true);

    backgroundSyncAdjuster.updateBatteryLevel(50, false);
    expect(backgroundSyncAdjuster.getState().isLowBattery).toBe(false);
    expect(backgroundSyncAdjuster.getState().currentIntervalMs).toBe(STANDARD_BEACON_INTERVAL_MS);
    expect(getMeshSyncInterval()).toBe(STANDARD_BEACON_INTERVAL_MS);
  });

  it('renders BackgroundSyncAdjusterCard and toggles simulation', () => {
    render(<BackgroundSyncAdjusterCard />);

    expect(screen.getByText(/Background Sync Interval Adjuster/i)).toBeDefined();

    const simBtn = screen.getByRole('button', { name: /Simulate <15% Battery/i });
    expect(simBtn).toBeDefined();

    fireEvent.click(simBtn);

    const updatedState = backgroundSyncAdjuster.getState();
    expect(updatedState.isLowBattery).toBe(true);
    expect(updatedState.currentIntervalMs).toBe(LOW_BATTERY_BEACON_INTERVAL_MS);
  });
});

describe('Feature 3: Web Crypto API Encryption Layer at Rest', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSecureMemoryCache();
  });

  afterEach(() => {
    localStorage.clear();
    clearSecureMemoryCache();
  });

  it('encrypts and decrypts text strings using Web Crypto AES-GCM-256', async () => {
    const sensitiveSecret = 'hoimu_private_seed_phrase_abandon_abandon_art';
    const encrypted = await encryptWithWebCrypto(sensitiveSecret);

    expect(isWebCryptoPayload(encrypted)).toBe(true);
    expect(encrypted).not.toContain(sensitiveSecret);

    const decrypted = await decryptWithWebCrypto(encrypted);
    expect(decrypted).toBe(sensitiveSecret);
  });

  it('ensures setSecureLocalStorage encrypts sensitive user profiles at rest', async () => {
    const mockUser: UserProfile = {
      id: 'usr_steward_1',
      callsign: 'Koidu-Steward',
      bio: 'Local greenhouse keeper & mesh anchor',
      skills: ['hydroponics', 'lora_relay'],
      offeredResources: ['Fresh Herbs', 'Seedlings'],
      symbiosisScore: 98,
      completedExchanges: 19,
      meshVisible: true,
      avatarSeed: 'koidu_seed',
      symbiosisHistory: [{ date: '2026-09-18', score: 98 }],
    };

    // Store using setSecureLocalStorageAsync
    const success = await setSecureLocalStorageAsync('hoimu_user', mockUser);
    expect(success).toBe(true);

    // Verify localStorage item at rest is encrypted (NEVER plaintext)
    const rawStored = localStorage.getItem('hoimu_user');
    expect(rawStored).toBeTruthy();
    expect(rawStored).not.toContain('Koidu-Steward');
    expect(rawStored).not.toContain('greenhouse');
    expect(isWebCryptoPayload(rawStored)).toBe(true);

    // Read back through clear cache
    clearSecureMemoryCache();
    const retrieved = await getSecureLocalStorageAsync<UserProfile>('hoimu_user', {} as any);
    expect(retrieved.callsign).toBe('Koidu-Steward');
    expect(retrieved.completedExchanges).toBe(19);
    expect(retrieved.skills).toEqual(['hydroponics', 'lora_relay']);
  });

  it('transparently decrypts synchronously via getSecureLocalStorage', () => {
    const sensitiveIdentity = {
      keyPair: { pub: 'pub_key_0x8291', priv: 'priv_seed_0x9923' },
      verifiedStatus: true,
    };

    setSecureLocalStorage('hoimu_crypto_identity', sensitiveIdentity);

    // Raw at rest is not plaintext
    const rawStored = localStorage.getItem('hoimu_crypto_identity');
    expect(rawStored).toBeTruthy();
    expect(rawStored).not.toContain('priv_seed_0x9923');

    // Retrieve via synchronous reader
    const recovered = getSecureLocalStorage('hoimu_crypto_identity', null);
    expect(recovered).toEqual(sensitiveIdentity);
  });
});
