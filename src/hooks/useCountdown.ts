
import { useState, useEffect } from 'react';

export function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetMs - Date.now())
  );

  useEffect(() => {
    if (targetMs === 0) return;
    const interval = setInterval(() => {
      const left = Math.max(0, targetMs - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return { display: `${pad(h)}:${pad(m)}:${pad(s)}`, done: remaining === 0 };
}