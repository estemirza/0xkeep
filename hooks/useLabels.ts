'use client';

import { useState, useEffect } from 'react';

export function useLabels() {
  const [labels, setLabels] = useState<Record<string, string>>({});

  // Load from LocalStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('0xkeep-labels');
    if (stored) {
      setLabels(JSON.parse(stored));
    }
  }, []);

  // Save Label
  const setLabel = (id: string, name: string) => {
    const newLabels = { ...labels, [id]: name };
    setLabels(newLabels);
    localStorage.setItem('0xkeep-labels', JSON.stringify(newLabels));
  };

  return { labels, setLabel };
}