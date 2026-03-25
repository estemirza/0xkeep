'use client';

import { useState, useEffect } from 'react';

export function useArchived() {
    const [archived, setArchived] = useState<string[]>([]);

    const load = () => {
        const stored = localStorage.getItem('0xkeep-archived');
        if (stored) setArchived(JSON.parse(stored));
    };

    useEffect(() => {
        load();
        window.addEventListener('archive-updated', load);
        return () => window.removeEventListener('archive-updated', load);
    },[]);

    const toggleArchive = (id: string) => {
        const stored = localStorage.getItem('0xkeep-archived');
        let current = stored ? JSON.parse(stored) : [];
        const newArchived = current.includes(id) ? current.filter((a: string) => a !== id) :[...current, id];
        
        localStorage.setItem('0xkeep-archived', JSON.stringify(newArchived));
        setArchived(newArchived);
        window.dispatchEvent(new Event('archive-updated')); // Triggers re-render instantly
    };

    return { archived, toggleArchive };
}