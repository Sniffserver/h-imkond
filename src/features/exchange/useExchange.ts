import { useState, useCallback } from 'react';
import { ResourceItem, Transaction, WishlistItem } from '../../types';
import { INITIAL_RESOURCES, INITIAL_TRANSACTIONS } from '../../data/initialData';
import { INITIAL_WISHLIST } from '../../data/communityData';

export function useExchange() {
  const [resources, setResources] = useState<ResourceItem[]>(() => {
    const saved = localStorage.getItem('hoimu_resources');
    return saved ? JSON.parse(saved) : INITIAL_RESOURCES;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('hoimu_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    const saved = localStorage.getItem('hoimu_wishlist');
    return saved ? JSON.parse(saved) : INITIAL_WISHLIST;
  });

  const requestExchange = useCallback(
    (resource: ResourceItem, requesterId: string, requesterCallsign: string) => {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        resourceId: resource.id,
        resourceTitle: resource.title,
        requesterId,
        requesterCallsign,
        providerId: resource.ownerId,
        providerCallsign: resource.ownerCallsign,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setTransactions((prev) => [newTx, ...prev]);
      return newTx;
    },
    []
  );

  return {
    resources,
    setResources,
    transactions,
    setTransactions,
    wishlist,
    setWishlist,
    requestExchange,
  };
}
