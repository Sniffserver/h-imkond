import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSignedVoteEvent,
  verifyVoteEvent,
  tallyVotesForProposal,
  projectProposalsWithTallies,
  calculateQuadraticVoteCost,
  canAffordQuadraticVote,
  DaoVoteEvent,
} from '../services/governance/daoVoteEngine';
import { crdtEventLogEngine } from '../services/mesh/crdt/signedEventLog';
import { canonicalize, signCanonicalPayload, verifyCanonicalPayload, deriveEd25519KeyPairFromSeed } from '../services/crypto/meshCrypto';
import { DaoProposal } from '../types';

describe('Decentralized Governance: Cryptographic Signed Voting & Deterministic Tally', () => {
  beforeEach(() => {
    crdtEventLogEngine.clearMemoryLog();
  });

  describe('Ed25519 Canonical Attestation & Verification', () => {
    it('canonicalizes JSON deterministically independent of key order', () => {
      const objA = { z: 1, a: 2, m: { b: 3, a: 4 } };
      const objB = { a: 2, m: { a: 4, b: 3 }, z: 1 };

      const canonicalA = canonicalize(objA);
      const canonicalB = canonicalize(objB);

      expect(new TextDecoder().decode(canonicalA)).toBe(new TextDecoder().decode(canonicalB));
      expect(new TextDecoder().decode(canonicalA)).toBe('{"a":2,"m":{"a":4,"b":3},"z":1}');
    });

    it('creates genuine Ed25519 signed vote events verifiable by all mesh nodes', async () => {
      const keypair = await deriveEd25519KeyPairFromSeed('voter-node-tartu-01');

      const voteEvent = await createSignedVoteEvent({
        voterId: 'NODE-TARTU-01',
        voterCallsign: 'TARTU-01',
        voterPublicKey: keypair.publicKeyHex,
        proposalId: 'prop-radio-repeater',
        choice: 'yes',
        votesCount: 3,
        signingKey: keypair.keyPair.privateKey,
      });

      expect(voteEvent.signature).toBeDefined();
      expect(voteEvent.signature.length).toBeGreaterThanOrEqual(64);
      expect(voteEvent.creditCost).toBe(9); // 3^2 = 9 credits under quadratic voting

      // Node verifies vote attestation
      const isValid = await verifyVoteEvent(voteEvent);
      expect(isValid).toBe(true);

      // Tampered vote is rejected
      const tamperedVote = { ...voteEvent, choice: 'no' as const };
      const isTamperedValid = await verifyVoteEvent(tamperedVote);
      expect(isTamperedValid).toBe(false);
    });
  });

  describe('Deterministic Tally Projection & Sybil Protection', () => {
    it('tallies verified votes deterministically from event log', () => {
      const votes: DaoVoteEvent[] = [
        {
          opId: 'vote_1',
          voterId: 'PEER_A',
          voterCallsign: 'PEER_A',
          voterPublicKey: 'pub_a',
          proposalId: 'prop_01',
          choice: 'yes',
          votesCount: 2,
          creditCost: 4,
          timestamp: 1000,
          nonce: 'n1',
          signature: 'sig1',
        },
        {
          opId: 'vote_2',
          voterId: 'PEER_B',
          voterCallsign: 'PEER_B',
          voterPublicKey: 'pub_b',
          proposalId: 'prop_01',
          choice: 'yes',
          votesCount: 3,
          creditCost: 9,
          timestamp: 1010,
          nonce: 'n2',
          signature: 'sig2',
        },
        {
          opId: 'vote_3',
          voterId: 'PEER_C',
          voterCallsign: 'PEER_C',
          voterPublicKey: 'pub_c',
          proposalId: 'prop_01',
          choice: 'no',
          votesCount: 1,
          creditCost: 1,
          timestamp: 1020,
          nonce: 'n3',
          signature: 'sig3',
        },
      ];

      const tally = tallyVotesForProposal('prop_01', votes);
      expect(tally.votesYes).toBe(5); // 2 + 3
      expect(tally.votesNo).toBe(1);
      expect(tally.votesAbstain).toBe(0);
      expect(tally.totalVoters).toBe(3);
    });

    it('prevents double-voting and overwrites previous vote with latest timestamp (idempotency)', () => {
      const votes: DaoVoteEvent[] = [
        {
          opId: 'vote_1',
          voterId: 'PEER_A',
          voterCallsign: 'PEER_A',
          voterPublicKey: 'pub_a',
          proposalId: 'prop_01',
          choice: 'yes',
          votesCount: 1,
          creditCost: 1,
          timestamp: 1000,
          nonce: 'n1',
          signature: 'sig1',
        },
        // Duplicate vote by PEER_A changing vote from yes to no at a later timestamp
        {
          opId: 'vote_2',
          voterId: 'PEER_A',
          voterCallsign: 'PEER_A',
          voterPublicKey: 'pub_a',
          proposalId: 'prop_01',
          choice: 'no',
          votesCount: 2,
          creditCost: 4,
          timestamp: 2000,
          nonce: 'n2',
          signature: 'sig2',
        },
      ];

      const tally = tallyVotesForProposal('prop_01', votes);
      expect(tally.totalVoters).toBe(1); // Exactly 1 voter counted
      expect(tally.votesYes).toBe(0);     // Previous vote superseded
      expect(tally.votesNo).toBe(2);      // Newer vote applied
    });
  });

  describe('Quadratic Voting Constraints', () => {
    it('calculates quadratic cost correctly: cost = votes^2', () => {
      expect(calculateQuadraticVoteCost(1)).toBe(1);
      expect(calculateQuadraticVoteCost(2)).toBe(4);
      expect(calculateQuadraticVoteCost(3)).toBe(9);
      expect(calculateQuadraticVoteCost(4)).toBe(16);
      expect(calculateQuadraticVoteCost(5)).toBe(25);
    });

    it('validates user credit balance against quadratic cost', () => {
      expect(canAffordQuadraticVote(3, 10)).toBe(true);  // 3 votes = 9 <= 10 credits
      expect(canAffordQuadraticVote(3, 8)).toBe(false);  // 3 votes = 9 > 8 credits
      expect(canAffordQuadraticVote(4, 15)).toBe(false); // 4 votes = 16 > 15 credits
      expect(canAffordQuadraticVote(4, 16)).toBe(true);
    });
  });
});
