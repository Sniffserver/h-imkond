import React from 'react';
import { CrisisModeBar } from '../../components/CrisisModeBar';
import { SosAlertBanner } from '../../components/SosAlertBanner';
import { CrisisAlert } from '../../types';

export interface SosScreenProps {
  isCrisisMode: boolean;
  onToggleCrisisMode: () => void;
  crisisAlerts: CrisisAlert[];
  onBroadcastAlert: (alert: Omit<CrisisAlert, 'id' | 'timestamp' | 'resolved'>) => void;
  onResolveAlert: (id: string) => void;
  userCallsign: string;
  isNightMode?: boolean;
}

export const SosScreen: React.FC<SosScreenProps> = (props) => {
  return <CrisisModeBar {...props} />;
};

export { SosAlertBanner, CrisisModeBar };
