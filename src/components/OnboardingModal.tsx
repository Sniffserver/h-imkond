import React from 'react';
import { UserProfile } from '../types';
import { SolarpunkOnboardingFlow, MeshVisibilityPreferences } from './SolarpunkOnboardingFlow';

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNightMode?: boolean;
  onComplete?: (updatedProfile?: Partial<UserProfile>, visibilityPrefs?: MeshVisibilityPreferences) => void;
  currentUser?: UserProfile;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  isNightMode = false,
  onComplete,
  currentUser,
}) => {
  if (!isOpen) return null;

  return (
    <SolarpunkOnboardingFlow
      isOpen={isOpen}
      onClose={onClose}
      currentUser={currentUser}
      isNightMode={isNightMode}
      onComplete={(updatedProfile, visibilityPrefs) => {
        if (onComplete) {
          onComplete(updatedProfile, visibilityPrefs);
        } else {
          onClose();
        }
      }}
    />
  );
};
