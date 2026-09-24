'use client';

import { useState, useEffect, useCallback } from 'react';
import { CONTRACT_ADDRESSES } from '@/lib/contract';
import { parseId } from '@/lib/formatter';

const ARCHIVED_KEY  = '0xkeep-archived';
const WITHDRAWN_KEY = '0xkeep-withdrawn';

function loadFromStorage(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function saveToStorage(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useArchived() {
  const [archived,  setArchived]  = useState<string[]>([]);
  const [withdrawn, setWithdrawn] = useState<string[]>([]);

  const load = useCallback(() => {
    setArchived(loadFromStorage(ARCHIVED_KEY));
    setWithdrawn(loadFromStorage(WITHDRAWN_KEY));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('archive-updated', load);
    return () => window.removeEventListener('archive-updated', load);
  }, [load]);

  const toggleArchive = (id: string) => {
    const newArchived = archived.includes(id)
      ? archived.filter(a => a !== id)
      : [...archived, id];
    setArchived(newArchived);
    saveToStorage(ARCHIVED_KEY, newArchived);
    window.dispatchEvent(new Event('archive-updated'));
  };

  const addWithdrawn = (id: string) => {
    if (withdrawn.includes(id)) return;
    const newWithdrawn = [...withdrawn, id];
    setWithdrawn(newWithdrawn);
    saveToStorage(WITHDRAWN_KEY, newWithdrawn);
    window.dispatchEvent(new Event('archive-updated'));
  };

  // ← removeWithdrawn is intentionally removed.
  // withdrawn[] is permanent — it tracks that a lock was ever withdrawn.
  // archived[] controls visibility. Never remove from withdrawn on archive/unarchive.

  // Only expose withdrawn IDs on chains the app currently supports. Old testnet
  // IDs (e.g. 0xK-BSL-3) stay in storage but are hidden while testnets are off;
  // otherwise the dashboard counts them and their rows spin forever.
  const visibleWithdrawn = withdrawn.filter(id => {
    try { return parseId(id).chainId in CONTRACT_ADDRESSES; } catch { return false; }
  });

  return { archived, withdrawn: visibleWithdrawn, toggleArchive, addWithdrawn };
}