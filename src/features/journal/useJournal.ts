import { useState, useCallback } from 'react';
import { JournalEntry, SentimentType } from '../../types';
import { INITIAL_JOURNAL } from '../../data/initialData';
import { getSecureLocalStorage, setSecureLocalStorage } from '../../utils/localStorageValidator';

export function useJournal() {
  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    return getSecureLocalStorage<JournalEntry[]>('hoimu_journal', INITIAL_JOURNAL);
  });

  const addJournalEntry = useCallback(
    (partnerCallsign: string, resourceTitle: string, reflection: string, sentiment: SentimentType) => {
      const newEntry: JournalEntry = {
        id: `journal-${Date.now()}`,
        partnerCallsign,
        resourceTitle,
        reflection,
        sentiment,
        scoreDelta: 5,
        timestamp: Date.now(),
      };
      setJournal((prev) => {
        const next = [newEntry, ...prev];
        setSecureLocalStorage('hoimu_journal', next);
        return next;
      });
      return newEntry;
    },
    []
  );

  return {
    journal,
    setJournal,
    addJournalEntry,
  };
}
