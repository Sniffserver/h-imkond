import { useState, useCallback } from 'react';
import { UserProfile, CryptoIdentity } from '../../types';
import { INITIAL_USER } from '../../data/initialData';
import { INITIAL_CRYPTO_IDENTITY } from '../../data/communityData';
import { getSecureLocalStorage, setSecureLocalStorage } from '../../utils/localStorageValidator';

export function useProfile() {
  const [user, setUser] = useState<UserProfile>(() => {
    return getSecureLocalStorage<UserProfile>('hoimu_user', INITIAL_USER);
  });

  const [cryptoIdentity, setCryptoIdentityState] = useState<CryptoIdentity>(() => {
    return getSecureLocalStorage<CryptoIdentity>('hoimu_crypto_identity', INITIAL_CRYPTO_IDENTITY);
  });

  const setCryptoIdentity = useCallback((updater: CryptoIdentity | ((prev: CryptoIdentity) => CryptoIdentity)) => {
    setCryptoIdentityState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setSecureLocalStorage('hoimu_crypto_identity', next);
      return next;
    });
  }, []);

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
