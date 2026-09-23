import { useState, useCallback, useEffect } from 'react';
import { DaoProposal, ProposalCategory } from '../../types';
import { INITIAL_DAO_PROPOSALS } from '../../data/communityData';
import {
  calculateQuadraticVoteCost,
  canAffordQuadraticVote,
  createSignedVoteEvent,
  projectProposalsWithTallies,
} from '../../services/governance/daoVoteEngine';
import { INITIAL_USER } from '../../data/initialData';

export { calculateQuadraticVoteCost, canAffordQuadraticVote };

export function useGovernance(userBalance: number = 100, userCallsign: string = INITIAL_USER.callsign) {
  const [daoProposals, setDaoProposals] = useState<DaoProposal[]>(() => {
    const saved = localStorage.getItem('hoimu_dao_proposals');
    const base = saved ? JSON.parse(saved) : INITIAL_DAO_PROPOSALS;
    return projectProposalsWithTallies(base, userCallsign);
  });

  useEffect(() => {
    localStorage.setItem('hoimu_dao_proposals', JSON.stringify(daoProposals));
  }, [daoProposals]);

  const voteProposal = useCallback(
    (
      proposalId: string,
      vote: 'yes' | 'no' | 'abstain',
      votesCount: number = 1,
      balanceOverride?: number
    ): { success: boolean; cost: number; reason?: string } => {
      const target = daoProposals.find((p) => p.id === proposalId);
      if (!target) {
        return { success: false, cost: 0, reason: 'PROPOSAL_NOT_FOUND' };
      }

      // Duplicate vote prevention
      if (target.userVoted) {
        return { success: false, cost: 0, reason: 'ALREADY_VOTED' };
      }

      const balance = balanceOverride !== undefined ? balanceOverride : userBalance;
      const cost = calculateQuadraticVoteCost(votesCount);

      if (!canAffordQuadraticVote(votesCount, balance)) {
        return { success: false, cost, reason: 'INSUFFICIENT_BALANCE' };
      }

      // 1. Create cryptographic signed vote event (Ed25519) and dispatch to CRDT Event Log
      createSignedVoteEvent({
        voterId: userCallsign,
        voterCallsign: userCallsign,
        proposalId,
        choice: vote,
        votesCount,
      }).catch((err) => {
        console.warn('[useGovernance] Error signing vote event:', err);
      });

      // 2. Update local state
      setDaoProposals((prev) =>
        prev.map((p) => {
          if (p.id === proposalId) {
            return {
              ...p,
              userVoted: vote,
              votesYes: vote === 'yes' ? p.votesYes + votesCount : p.votesYes,
              votesNo: vote === 'no' ? p.votesNo + votesCount : p.votesNo,
              votesAbstain: vote === 'abstain' ? p.votesAbstain + votesCount : p.votesAbstain,
            };
          }
          return p;
        })
      );

      return { success: true, cost };
    },
    [daoProposals, userBalance, userCallsign]
  );

  const createProposal = useCallback(
    (
      authorCallsign: string,
      initialVotes: number,
      data: {
        title: string;
        description: string;
        category: ProposalCategory;
      }
    ) => {
      const newProp: DaoProposal = {
        id: `prop-${Date.now()}`,
        title: data.title,
        description: data.description,
        category: data.category,
        authorCallsign,
        votesYes: initialVotes,
        votesNo: 0,
        votesAbstain: 0,
        userVoted: 'yes',
        status: 'active',
        endsAt: Date.now() + 604800000,
        symbiosisReward: 15,
        requiredQuorum: 200,
      };

      setDaoProposals((prev) => [newProp, ...prev]);
      return newProp;
    },
    []
  );

  return {
    daoProposals,
    setDaoProposals,
    voteProposal,
    createProposal,
    calculateQuadraticVoteCost,
    canAffordQuadraticVote,
  };
}

