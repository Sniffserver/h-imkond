import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Robust lazy loading wrapper with automatic retry capabilities.
 * If a dynamically imported module fails due to network fluctuation, Vite cache revalidation,
 * or container restart, it automatically retries multiple times before failing gracefully.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  retries = 3,
  interval = 800
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remainingRetries: number) => {
        factory()
          .then((module) => {
            if (module && typeof module === 'object') {
              if (module.default) {
                resolve(module);
              } else {
                // If named export was resolved
                const firstKey = Object.keys(module).find((k) => k !== '__esModule');
                if (firstKey && module[firstKey]) {
                  resolve({ default: module[firstKey] });
                } else {
                  resolve({ default: module as any });
                }
              }
            } else {
              resolve({ default: module });
            }
          })
          .catch((error) => {
            console.warn(
              `[HÕIMU Dynamic Import] Module fetch attempt failed (${remainingRetries} retries left):`,
              error
            );
            if (remainingRetries > 0) {
              setTimeout(() => {
                attempt(remainingRetries - 1);
              }, interval);
            } else {
              reject(error);
            }
          });
      };

      attempt(retries);
    })
  );
}
