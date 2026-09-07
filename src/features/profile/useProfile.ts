import { useState, useCallback } from 'react';
import { UserProfile, CryptoIdentity } from '../../types';
import { INITIAL_USER } from '../../data/initialData';
import { INITIAL_CRYPTO_IDENTITY } from '../../data/communityData';
import { getSecureLocalStorage, setSecureLocalStorage } from '../../utils/localStorageValidator';

export function useProfile() {
  const [user, setUser] = useState<UserProfile>(() => {
    return getSecureLocalStorage<UserProfile>('hoimu_user', INITIAL_USER);
  });

  const [cryptoIdentity, setCryptoIdentity] = useState<CryptoIdentity>(() => {
    const saved = localStorage.getItem('hoimu_crypto_identity');
    return saved ? JSON.parse(saved) : INITIAL_CRYPTO_IDENTITY;
  });

  const updateProfile = useCallback((updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      setSecureLocalStorage('hoimu_user', next);
      return next;
    });
  }, []);

  return {
    user,
    setUser,
    cryptoIdentity,
    setCryptoIdentity,
    updateProfile,
  };
}
