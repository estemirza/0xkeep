'use client';

import { useState, useEffect } from 'react';

export function useArchived() {
  const [archived, setArchived] = useState<string[]>([]);

  const load = () => {
    try {
      const stored = localStorage.getItem('0xkeep-archived');
      if (stored) setArchived(JSON.parse(stored));
    } catch {
      // Storage was corrupted — clear it and recover cleanly
      localStorage.removeItem('0xkeep-archived');
      setArchived([]);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener('archive-updated', load);
    return () => window.removeEventListener('archive-updated', load);
  }, []);

  const toggleArchive = (id: string) => {
    // FIX H2: Use state as source of truth, not localStorage
    const newArchived = archived.includes(id)
      ? archived.filter((a) => a !== id)
      : [...archived, id];

    setArchived(newArchived);
    localStorage.setItem('0xkeep-archived', JSON.stringify(newArchived));
    window.dispatchEvent(new Event('archive-updated'));
  };

  return { archived, toggleArchive };
}