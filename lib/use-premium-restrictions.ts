import { useState, useEffect } from 'react';

const SKIP_LIMIT = 6; // Límite de saltos por hora para usuarios no premium
const STORAGE_KEY = 'spotify_skips';

interface SkipData {
  count: number;
  lastReset: number;
}

export function usePremiumRestrictions() {
  const [skipData, setSkipData] = useState<SkipData>({ count: 0, lastReset: Date.now() });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        if (now - parsed.lastReset > oneHour) {
          setSkipData({ count: 0, lastReset: now });
        } else {
          setSkipData(parsed);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(skipData));
    }
  }, [skipData]);

  const incrementSkip = () => {
    setSkipData(prev => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      if (now - prev.lastReset > oneHour) {
        return { count: 1, lastReset: now };
      }
      return { ...prev, count: prev.count + 1 };
    });
  };

  const skipLimitReached = skipData.count >= SKIP_LIMIT;
  const remainingSkips = Math.max(0, SKIP_LIMIT - skipData.count);

  return {
    skipLimitReached,
    remainingSkips,
    incrementSkip,
  };
}