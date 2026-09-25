import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useGovernance,
  calculateQuadraticVoteCost,
  canAffordQuadraticVote,
} from '../../../features/governance/useGovernance';
import { crdtEventLogEngine } from '../../../services/mesh/crdt/signedEventLog';

describe('useGovernance & Quadratic Voting Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    crdtEventLogEngine.clearMemoryLog();
  });

  describe('Quadratic Voting Governing Formula: cost = (number of votes)^2', () => {
    it('directly calculates quadratic vote costs across key test vectors', () => {
      // Core spec requirement: 3 votes cost 3^2 = 9 credits, NOT 3
      expect(calculateQuadraticVoteCost(3)).toBe(9);

      // Boundary: 0 votes
      expect(calculateQuadraticVoteCost(0)).toBe(0);

      // Boundary: 1 vote
      expect(calculateQuadraticVoteCost(1)).toBe(1);

      // Boundary: 2 votes
      expect(calculateQuadraticVoteCost(2)).toBe(4);

      // Boundary: 5 votes
      expect(calculateQuadraticVoteCost(5)).toBe(25);

      // Boundary: Large values (10 votes)
      expect(calculateQuadraticVoteCost(10)).toBe(100);

      // Invalid or negative values
      expect(calculateQuadraticVoteCost(-5)).toBe(0);
      expect(calculateQuadraticVoteCost(NaN)).toBe(0);
    });

    it('evaluates affordability boundaries based on credit balance', () => {
      const userBalance = 8; // User has 8 credits

      // 1 vote costs 1 credit <= 8 -> true
      expect(canAffordQuadraticVote(1, userBalance)).toBe(true);

      // 2 votes cost 4 credits <= 8 -> true
      expect(canAffordQuadraticVote(2, userBalance)).toBe(true);

      // 3 votes cost 9 credits > 8 -> false (Insufficient balance boundary)
      expect(canAffordQuadraticVote(3, userBalance)).toBe(false);

      // 4 votes cost 16 credits > 8 -> false
      expect(canAffordQuadraticVote(4, userBalance)).toBe(false);
    });
  });

  describe('Proposal Voting & Duplicate Prevention', () => {
    it('executes valid quadratic votes and updates proposal tally', () => {
      const { result } = renderHook(() => useGovernance(100)); // Balance = 100

      const targetProp = result.current.daoProposals[0];
      const initialYes = targetProp.votesYes;

      // Cast 3 votes (cost = 9)
      let voteRes: any;
      act(() => {
        voteRes = result.current.voteProposal(targetProp.id, 'yes', 3);
      });

      expect(voteRes.success).toBe(true);
      expect(voteRes.cost).toBe(9);

      const updatedProp = result.current.daoProposals.find((p) => p.id === targetProp.id);
      expect(updatedProp?.votesYes).toBe(initialYes + 3);
      expect(updatedProp?.userVoted).toBe('yes');
    });

    it('prevents duplicate voting on the same proposal', () => {
      const { result } = renderHook(() => useGovernance(100));

      const targetProp = result.current.daoProposals[0];

      // First vote succeeds
      act(() => {
        result.current.voteProposal(targetProp.id, 'yes', 1);
      });

      // Second vote attempt on same proposal is rejected
      let secondVoteRes: any;
      act(() => {
        secondVoteRes = result.current.voteProposal(targetProp.id, 'no', 1);
      });

      expect(secondVoteRes.success).toBe(false);
      expect(secondVoteRes.reason).toBe('ALREADY_VOTED');
    });

    it('rejects votes when credit balance is insufficient for quadratic cost', () => {
      const { result } = renderHook(() => useGovernance(5)); // Low balance = 5 credits

      const targetProp = result.current.daoProposals[0];

      // Requesting 3 votes costs 9 credits > 5 credits balance
      let voteRes: any;
      act(() => {
        voteRes = result.current.voteProposal(targetProp.id, 'yes', 3);
      });

      expect(voteRes.success).toBe(false);
      expect(voteRes.cost).toBe(9);
      expect(voteRes.reason).toBe('INSUFFICIENT_BALANCE');
    });

    it('creates new proposals with deterministic initial state', () => {
      const { result } = renderHook(() => useGovernance(100));

      let newProp: any;
      act(() => {
        newProp = result.current.createProposal('AUTHOR-01', 5, {
          title: 'Install Micro-Hydro Generator at Stream',
          description: 'Local clean power generation proposal.',
          category: 'Infrastructure',
        });
      });

      expect(newProp).toBeDefined();
      expect(newProp.status).toBe('active');
      expect(newProp.votesYes).toBe(5);
      expect(newProp.authorCallsign).toBe('AUTHOR-01');
      expect(newProp.endsAt).toBeGreaterThan(Date.now());

      const created = result.current.daoProposals.find((p) => p.id === newProp.id);
      expect(created).toBeDefined();
      expect(created?.title).toBe('Install Micro-Hydro Generator at Stream');
    });
  });
});
