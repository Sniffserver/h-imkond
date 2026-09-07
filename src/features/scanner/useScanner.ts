import { useState, useCallback } from 'react';

export function useScanner() {
  const [isScanning, setIsScanning] = useState(false);

  const startScan = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 2000);
  }, []);

  return {
    isScanning,
    startScan,
  };
}
