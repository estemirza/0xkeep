'use client';

import { useState, useEffect, useMemo } from "react";
import { Loader2, ChevronLeft, ChevronRight, Search, Filter, ArrowUpDown } from "lucide-react";
import { useAccount, useReadContracts } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { LockRow, VestingRow } from "@/components/DashboardRows";
import { useLabels } from "@/hooks/useLabels";
import { useArchived } from "@/hooks/useArchived";
import { formatLockId, formatVestingId, parseId } from "@/lib/formatter";
import { formatUnits } from "viem";
import Navbar from "@/components/Navbar";

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const safePrefetchedData = (data: any): Record<string, any> | null => {
  if (!data) return null;
  try {
    return JSON.parse(
      JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    );
  } catch {
    return null;
  }
};

const SUPPORTED_CHAINS = Object.keys(CONTRACT_ADDRESSES).map(Number);

type OmniId = {
  rawId: bigint;
  chainId: number;
  fancyId: string;
  data: Record<string, any> | null;
  normalizedAmount: number;
  isWithdrawnLocal?: boolean;
};

export default function ArchiveDashboard() {
  const [activeTab, setActiveTab]     = useState<'locks' | 'vesting'>('locks');
  const { address, isConnected }      = useAccount();
  const { labels }                    = useLabels();
  const { archived, withdrawn, toggleArchive } = useArchived();

  const [searchQuery, setSearchQuery]   = useState("");
  const [sortOrder, setSortOrder]       = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [filterType, setFilterType]     = useState<'all' | 'labeled' | 'unlabeled'>('all');
  const [currentPage, setCurrentPage]   = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ── FETCH IDS FROM ALL CHAINS ──
  const { data: lockIdsData, isLoading: locksLoading } = useReadContracts({
    contracts: SUPPORTED_CHAINS.map(cId => ({
      address: CONTRACT_ADDRESSES[cId] as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'getUserLocks',
      args: address ? [address] : undefined,
      chainId: cId,
    })),
    query: { enabled: !!address },
  });

  const { data: vestingIdsData, isLoading: vestingLoading } = useReadContracts({
    contracts: SUPPORTED_CHAINS.map(cId => ({
      address: CONTRACT_ADDRESSES[cId] as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'getUserVestings',
      args: address ? [address] : undefined,
      chainId: cId,
    })),
    query: { enabled: !!address },
  });

  // ── ARCHIVED COUNTS ──
  // Locks: archived = withdrawn locks that user clicked Archive on
  const archivedLocksCount = useMemo(() => {
    // Count withdrawn locks that are in the archived list
    return withdrawn.filter(fancyId => archived.includes(fancyId)).length;
  }, [withdrawn, archived]);

  // Vestings: archived = completed vestings that user clicked Archive on
  const archivedVestingsCount = useMemo(() => {
    if (!vestingIdsData) return 0;
    let count = 0;
    vestingIdsData.forEach((res, index) => {
      if (res.status === 'success' && res.result) {
        const chainId = SUPPORTED_CHAINS[index];
        (res.result as unknown as bigint[]).forEach(id => {
          if (archived.includes(formatVestingId(id, chainId))) count++;
        });
      }
    });
    return count;
  }, [vestingIdsData, archived]);

  // ── FLATTEN IDS — ONLY ARCHIVED ITEMS ──
  const activeIdsList = useMemo(() => {
    const result: { rawId: bigint; chainId: number; fancyId: string; isWithdrawnLocal?: boolean }[] = [];

    if (activeTab === 'locks') {
      // Archived locks = withdrawn locks that the user has also archived
      withdrawn.forEach(fancyId => {
        if (!archived.includes(fancyId)) return;
        try {
          const parsed = parseId(fancyId);
          if (parsed.type !== 'lock') return;
          result.push({
            rawId: parsed.rawId,
            chainId: parsed.chainId,
            fancyId,
            isWithdrawnLocal: true,
          });
        } catch { /* invalid fancyId, skip */ }
      });
    } else {
      // Archived vestings come from on-chain array filtered by archived list
      if (!vestingIdsData) return result;
      vestingIdsData.forEach((res, index) => {
        if (res.status === 'success' && res.result) {
          const chainId = SUPPORTED_CHAINS[index];
          (res.result as unknown as bigint[]).forEach(id => {
            const fancyId = formatVestingId(id, chainId);
            if (!archived.includes(fancyId)) return;
            result.push({ rawId: id, chainId, fancyId });
          });
        }
      });
    }

    return result;
  }, [activeTab, vestingIdsData, archived, withdrawn]);

  // ── BATCH FETCH ROW DATA ──
  const { data: rowData } = useReadContracts({
    contracts: activeIdsList.map(item => ({
      address: CONTRACT_ADDRESSES[item.chainId] as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: activeTab === 'locks' ? 'locks' : 'vestings',
      args: [item.rawId],
      chainId: item.chainId,
    })),
    query: { enabled: activeIdsList.length > 0 },
  });

  // ── PROCESS: FILTER + SORT ──
  const processedItems: OmniId[] = useMemo(() => {
    const mapped = activeIdsList.map((item, index) => {
      const raw      = rowData?.[index]?.result as any;
      const safeData = safePrefetchedData(raw);

      let normalizedAmount = 0;
      if (raw) {
        const rawAmount = raw[1] ? BigInt(raw[1]) : BigInt(0);
        const decimals  = Number(raw[3] ?? 18);
        normalizedAmount = Number(formatUnits(rawAmount, decimals));
      }

      return {
        ...item,
        data: safeData,
        normalizedAmount,
        isWithdrawnLocal: item.isWithdrawnLocal ?? false,
      };
    });

    const filtered = mapped.filter(item => {
      const label = labels[item.fancyId] || "";
      if (filterType === 'labeled'   && !label) return false;
      if (filterType === 'unlabeled' &&  label) return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.fancyId.toLowerCase().includes(query) ||
        label.toLowerCase().includes(query)
      );
    });

    filtered.sort((a, b) => {
      if (sortOrder === 'newest') {
        const diff = b.rawId - a.rawId;
        if (diff !== BigInt(0)) return diff > BigInt(0) ? 1 : -1;
        return b.chainId - a.chainId;
      }
      if (sortOrder === 'oldest') {
        const diff = a.rawId - b.rawId;
        if (diff !== BigInt(0)) return diff > BigInt(0) ? 1 : -1;
        return a.chainId - b.chainId;
      }
      if (sortOrder === 'highest') return b.normalizedAmount - a.normalizedAmount;
      if (sortOrder === 'lowest')  return a.normalizedAmount - b.normalizedAmount;
      return 0;
    });

    return filtered;
  }, [activeIdsList, rowData, searchQuery, filterType, sortOrder, labels]);

  const totalFilteredItems = processedItems.length;
  const totalPages         = Math.ceil(totalFilteredItems / itemsPerPage) || 1;
  const startIndex         = (currentPage - 1) * itemsPerPage;
  const currentItems       = processedItems.slice(startIndex, startIndex + itemsPerPage);
  const idsLoading         = activeTab === 'locks' ? false : vestingLoading;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, itemsPerPage, searchQuery, sortOrder, filterType]);

  const goToNext = () => setCurrentPage(p => Math.min(p + 1, totalPages));
  const goToPrev = () => setCurrentPage(p => Math.max(p - 1, 1));

  return (
    <main className="h-full flex flex-col px-6 md:px-12 py-10 max-w-7xl mx-auto w-full overflow-hidden">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 shrink-0">
        <div>
          <h1 className="text-4xl md:text-5xl font-chakra font-bold text-zinc-500 mb-2 tracking-tight">
            Archived <span className="text-white">Vaults</span>
          </h1>
        </div>
        <div className="flex items-center gap-8 mt-4 md:mt-0">
          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9E] block mb-1">Archived Locks</span>
            <span className="text-3xl font-chakra font-bold text-zinc-400">{archivedLocksCount}</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9E] block mb-1">Archived Vestings</span>
            <span className="text-3xl font-chakra font-bold text-zinc-400">{archivedVestingsCount}</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 shrink-0">
        <div className="flex gap-2 bg-[#13131A] p-1.5 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('locks')}
            className={`px-6 py-2 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all ${activeTab === 'locks' ? 'bg-zinc-700 text-white font-bold' : 'text-[#8B8B9E] hover:text-white'}`}
          >
            Liquidity Locks
          </button>
          <button
            onClick={() => setActiveTab('vesting')}
            className={`px-6 py-2 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all ${activeTab === 'vesting' ? 'bg-zinc-700 text-white font-bold' : 'text-[#8B8B9E] hover:text-white'}`}
          >
            Vesting Schedules
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative min-w-[200px]">
            <input
              type="text" placeholder="Search..."
              className="w-full bg-[#13131A] border border-white/5 rounded-lg pl-9 pr-3 py-2.5 text-[11px] text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="appearance-none bg-[#13131A] border border-white/5 rounded-lg pl-9 pr-8 py-2.5 text-[11px] text-[#8B8B9E] font-mono focus:outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="all">All Items</option>
              <option value="labeled">Labeled Only</option>
              <option value="unlabeled">Unlabeled Only</option>
            </select>
            <Filter size={14} className="absolute left-3 top-3 text-zinc-500 pointer-events-none" />
            <ChevronDownIcon className="absolute right-3 top-3 text-zinc-500 pointer-events-none w-3 h-3" />
          </div>
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="appearance-none bg-[#13131A] border border-white/5 rounded-lg pl-9 pr-8 py-2.5 text-[11px] text-[#8B8B9E] font-mono focus:outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
            <ArrowUpDown size={14} className="absolute left-3 top-3 text-zinc-500 pointer-events-none" />
            <ChevronDownIcon className="absolute right-3 top-3 text-zinc-500 pointer-events-none w-3 h-3" />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
        <div className="overflow-auto flex-1 relative">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-7 px-5 py-4 border-b border-[#1C1C26] text-[10px] font-mono text-[#555566] uppercase tracking-widest bg-[#0F0F14] sticky top-0 z-10">
              <div>No.</div><div>ID / Label</div><div>Network</div><div>Token</div><div>Amount</div><div>Status</div><div>Action</div>
            </div>

            {!isConnected ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-[#555566] font-mono uppercase tracking-widest text-xs">
                <p>Connect wallet to view vaults</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1C1C26]">
                {idsLoading && (
                  <div className="p-12 flex justify-center text-zinc-500">
                    <Loader2 className="animate-spin" />
                  </div>
                )}

                {activeTab === 'locks' && currentItems.map((item, idx) => (
                  <LockRow
                    key={item.fancyId}
                    lockId={item.rawId}
                    chainId={item.chainId}
                    index={startIndex + idx + 1}
                    prefetchedData={item.data}
                    isWithdrawnLocal={item.isWithdrawnLocal}
                    onArchive={() => {
                      // Unarchive: remove from archived, keep in withdrawn
                      toggleArchive(item.fancyId);
                    }}
                  />
                ))}

                {activeTab === 'vesting' && currentItems.map((item, idx) => (
                  <VestingRow
                    key={item.fancyId}
                    vestingId={item.rawId}
                    chainId={item.chainId}
                    index={startIndex + idx + 1}
                    prefetchedData={item.data}
                  />
                ))}

                {!idsLoading && processedItems.length === 0 && (
                  <div className="p-16 text-center text-[#555566] font-mono uppercase tracking-widest text-xs">
                    {searchQuery ? "No matches found." : "No archived vaults found."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isConnected && processedItems.length > 0 && (
          <div className="px-6 py-4 bg-[#0F0F14] border-t border-[#1C1C26] flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <span className="text-[#555566] font-mono text-[10px] uppercase tracking-widest">Rows:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-transparent border border-white/10 text-[#8B8B9E] font-mono text-[10px] rounded px-2 py-1 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#555566] font-mono text-[10px] uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button onClick={goToPrev} disabled={currentPage === 1} className="text-[#8B8B9E] hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={goToNext} disabled={currentPage === totalPages} className="text-[#8B8B9E] hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}