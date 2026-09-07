import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMessage } from '../types';
import { ToastContainer } from '../components/ToastContainer';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (title: string, description?: string, type?: 'success' | 'warning' | 'info') => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useAppToasts() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useAppToasts must be used within an AppProviders');
  }
  return context;
}

export interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (title: string, description?: string, type: 'success' | 'warning' | 'info' = 'success') => {
      const id = Date.now().toString() + Math.random().toString().slice(2, 6);
      const newToast: ToastMessage = { id, title, description, type };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ErrorBoundary>
      <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
        {children}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </ToastContext.Provider>
    </ErrorBoundary>
  );
};
