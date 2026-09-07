import React from 'react';
import { JournalTab } from '../../components/JournalTab';
import { JournalEntry, MeshNode } from '../../types';

export interface JournalScreenProps {
  journal: JournalEntry[];
  peers: MeshNode[];
  userSymbiosisScore: number;
  completedExchangesCount: number;
  isNightMode?: boolean;
}

export const JournalScreen: React.FC<JournalScreenProps> = (props) => {
  return <JournalTab {...props} />;
};

export * from '../../components/JournalTab';
