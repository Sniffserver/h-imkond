import { useEffect, useRef } from 'react';
import { a11yAnnouncer } from '../services/a11y/a11yAnnouncer';

export interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  autoFocusFirst?: boolean;
  modalName?: string;
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([aria-hidden="true"]), [href]:not([aria-hidden="true"]), input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"]), select:not([disabled]):not([aria-hidden="true"]), textarea:not([disabled]):not([aria-hidden="true"]), [tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])';

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  autoFocusFirst = true,
  modalName,
  restoreFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element for restoration
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    // Announce modal open to screen readers
    if (modalName) {
      a11yAnnouncer.announceModalOpen(modalName);
    }

    // Auto-focus the first focusable element
    const container = containerRef.current;
    if (container && autoFocusFirst) {
      const timer = setTimeout(() => {
        const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          container.focus();
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocusFirst, modalName]);

  // Keyboard navigation & Focus Trapping handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close modal
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Tab key focus trap
      if (e.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;

        const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: if on first element, wrap to last
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  // Cleanup & restore focus on close
  useEffect(() => {
    return () => {
      if (restoreFocus && previousActiveElementRef.current) {
        try {
          previousActiveElementRef.current.focus();
        } catch {
          // Ignore if previous element was removed
        }
      }
      if (modalName) {
        a11yAnnouncer.announceModalClose(modalName);
      }
    };
  }, [modalName, restoreFocus]);

  return containerRef;
}
