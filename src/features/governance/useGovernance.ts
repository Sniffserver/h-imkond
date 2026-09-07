import { useState, useCallback, useEffect } from 'react';
import { DaoProposal, ProposalCategory } from '../../types';
import { INITIAL_DAO_PROPOSALS } from '../../data/communityData';

/**
 * Calculates credit cost for a given number of votes under Quadratic Voting.
 * Governing relationship: cost = (number of votes)^2
 * Example: 3 votes cost 3^2 = 9 credits.
 */
export function calculateQuadraticVoteCost(votes: number): number {
  if (typeof votes !== 'number' || isNaN(votes) || votes <= 0) {
    return 0;
  }
  const rounded = Math.floor(votes);
  return rounded * rounded;
}

/**
 * Checks whether a user with a given credit balance can afford a quadratic vote.
 */
export function canAffordQuadraticVote(votes: number, creditBalance: number): boolean {
  if (typeof creditBalance !== 'number' || isNaN(creditBalance) || creditBalance < 0) {
    return false;
  }
  const cost = calculateQuadraticVoteCost(votes);
  return creditBalance >= cost;
}

export function useGovernance(userBalance: number = 100) {
  const [daoProposals, setDaoProposals] = useState<DaoProposal[]>(() => {
    const saved = localStorage.getItem('hoimu_dao_proposals');
    return saved ? JSON.parse(saved) : INITIAL_DAO_PROPOSALS;
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
    [daoProposals, userBalance]
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

