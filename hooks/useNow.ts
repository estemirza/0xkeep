'use client';

import { useEffect, useState } from 'react';

// Current time in ms that re-renders the component every `intervalMs`.
// Without it, "locked / unlocked" and vesting amounts are computed once and
// stay frozen until the page is refreshed.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
