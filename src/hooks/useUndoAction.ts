import { useState, useCallback, useRef } from 'react';

export interface UndoableAction<T = unknown> {
  id: string;
  message: string;
  category?: 'resource' | 'message' | 'layer' | 'settings';
  payload?: T;
  onUndo: (payload?: T) => void | Promise<void>;
  timeoutMs?: number;
}

export interface ActiveUndoState {
  action: UndoableAction;
  timerId: NodeJS.Timeout;
  startTime: number;
}

export function useUndoAction() {
  const [activeUndo, setActiveUndo] = useState<ActiveUndoState | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerUndoableAction = useCallback(
    <T,>(
      message: string,
      onUndo: (payload?: T) => void | Promise<void>,
      payload?: T,
      timeoutMs: number = 6000,
      category: UndoableAction['category'] = 'resource'
    ) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const id = `undo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const action: UndoableAction<T> = {
        id,
        message,
        category,
        payload,
        onUndo: onUndo as (payload?: unknown) => void | Promise<void>,
        timeoutMs,
      };

      const timerId = setTimeout(() => {
        setActiveUndo(null);
      }, timeoutMs);

      timeoutRef.current = timerId;
      setActiveUndo({
        action: action as UndoableAction,
        timerId,
        startTime: Date.now(),
      });
    },
    []
  );

  const executeUndo = useCallback(async () => {
    if (!activeUndo) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      await activeUndo.action.onUndo(activeUndo.action.payload);
    } catch (e) {
      console.error('Failed to execute undo action:', e);
    } finally {
      setActiveUndo(null);
    }
  }, [activeUndo]);

  const dismissUndo = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setActiveUndo(null);
  }, []);

  return {
    activeUndo,
    triggerUndoableAction,
    executeUndo,
    dismissUndo,
  };
}
