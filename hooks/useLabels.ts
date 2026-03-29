'use client';

import { useState, useEffect } from 'react';

const MAX_LABEL_LENGTH = 64;
const STORAGE_KEY = '0xkeep-labels';

export function useLabels() {
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setLabels(JSON.parse(stored));
    } catch {
      // Storage was corrupted — clear it and recover cleanly
      localStorage.removeItem(STORAGE_KEY);
      setLabels({});
    }
  }, []);

  const setLabel = (id: string, name: string) => {
    // FIX H5: Enforce maximum label length
    const trimmed = name.trim().slice(0, MAX_LABEL_LENGTH);
    const newLabels = { ...labels, [id]: trimmed };
    setLabels(newLabels);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLabels));
  };

  const removeLabel = (id: string) => {
    // FIX H6: Actually delete the key instead of storing empty string
    const newLabels = { ...labels };
    delete newLabels[id];
    setLabels(newLabels);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLabels));
  };

  return { labels, setLabel, removeLabel };
}