'use client';

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Loader2, ChevronLeft, ChevronRight, Search, Download, Filter, ArrowUpDown } from "lucide-react";
import { useAccount, useReadContracts, usePublicClient } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { LockRow, VestingRow } from "@/components/DashboardRows";
import { useLabels } from "@/hooks/useLabels";
import { useArchived } from "@/hooks/useArchived"; // NEW
import { formatLockId, formatVestingId } from "@/lib/formatter";
import { formatUnits } from "viem";
import Navbar from "@/components/Navbar";

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);

const SUPPORTED_CHAINS = Object.keys(CONTRACT_ADDRESSES).map(Number);
type OmniId = { rawId: bigint, chainId: number, fancyId: string };

export default function Dashboard() {
  const[activeTab, setActiveTab] = useState<'locks' | 'vesting'>('locks');
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { labels } = useLabels();
  const { archived } = useArchived(); // NEW

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  // UPDATED FILTER OPTIONS
  const [filterType, setFilterType] = useState<'all' | 'labeled' | 'unlabeled'>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const[isExporting, setIsExporting] = useState(false);

  // 1. OMNI-CHAIN ID FETCHING
  const { data: lockIdsData, isLoading: locksLoading } = useReadContracts({
    contracts: SUPPORTED_CHAINS.map(cId => ({
        address: CONTRACT_ADDRESSES[cId] as `0x${string}`, abi: CONTRACT_ABI, functionName: 'getUserLocks', args: address ? [address] : undefined, chainId: cId
    })), query: { enabled: !!address }
  });

  const { data: vestingIdsData, isLoading: vestingLoading } = useReadContracts({
    contracts: SUPPORTED_CHAINS.map(cId => ({
        address: CONTRACT_ADDRESSES[cId] as `0x${string}`, abi: CONTRACT_ABI, functionName: 'getUserVestings', args: address ?[address] : undefined, chainId: cId
    })), query: { enabled: !!address }
  });

  // Calculate Active Totals (Excluding Archived)
  const activeLocksCount = useMemo(() => {
      if (!lockIdsData) return 0;
      let count = 0;
      lockIdsData.forEach((res, index) => {
          if (res.status === 'success' && res.result) {
              const chainId = SUPPORTED_CHAINS[index];
              const ids = res.result as unknown as bigint[];
              ids.forEach(id => {
                  const fancyId = formatLockId(id, chainId);
                  if (!archived.includes(fancyId)) count++; // Only count if NOT archived
              });
          }
      });
      return count;
  }, [lockIdsData, archived]);

  const activeVestingsCount = useMemo(() => {
      if (!vestingIdsData) return 0;
      let count = 0;
      vestingIdsData.forEach((res, index) => {
          if (res.status === 'success' && res.result) {
              const chainId = SUPPORTED_CHAINS[index];
              const ids = res.result as unknown as bigint[];
              ids.forEach(id => {
                  const fancyId = formatVestingId(id, chainId);
                  if (!archived.includes(fancyId)) count++; // Only count if NOT archived
              });
          }
      });
      return count;
  }, [vestingIdsData, archived]);

  // 2. AGGREGATE
  const activeIdsList = useMemo(() => {
      const data = activeTab === 'locks' ? lockIdsData : vestingIdsData;
      if (!data) return [];
      const result: OmniId[] =[];
      data.forEach((res, index) => {
          if (res.status === 'success' && res.result) {
              const chainId = SUPPORTED_CHAINS[index];
              const ids = res.result as unknown as bigint[];
              ids.forEach(id => result.push({ rawId: id, chainId, fancyId: activeTab === 'locks' ? formatLockId(id, chainId) : formatVestingId(id, chainId) }));
          }
      });
      return result;
  },[activeTab, lockIdsData, vestingIdsData]);

  // 3. FETCH BATCH DATA
  const { data: rowData } = useReadContracts({
    contracts: activeIdsList.map(item => ({
        address: CONTRACT_ADDRESSES[item.chainId] as `0x${string}`, abi: CONTRACT_ABI, functionName: activeTab === 'locks' ? 'locks' : 'vestings', args:[item.rawId], chainId: item.chainId
    })), query: { enabled: activeIdsList.length > 0 }
  });

  // 4. FILTER & SORT (Filters out archived items)
  const processedItems = useMemo(() => {
      const mapped = activeIdsList.map((item, index) => {
          const data = rowData?.[index]?.result as any;
          let normalizedAmount = 0;
          if (data) {
              const rawAmount = data[1] || BigInt(0);
              const decimals = data[3] || 18;
              normalizedAmount = Number(formatUnits(rawAmount, decimals));
          }
          return { ...item, data, normalizedAmount };
      });

      const filtered = mapped.filter(item => {
          // EXCLUDE ARCHIVED ITEMS
          if (archived.includes(item.fancyId)) return false;

          const label = labels[item.fancyId] || "";

          // NEW FILTER LOGIC
          if (filterType === 'labeled' && !label) return false;
          if (filterType === 'unlabeled' && label) return false;

          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return item.fancyId.toLowerCase().includes(query) || label.toLowerCase().includes(query);
      });

      filtered.sort((a, b) => {
          if (sortOrder === 'newest') return Number(b.rawId - a.rawId);
          if (sortOrder === 'oldest') return Number(a.rawId - b.rawId);
          if (sortOrder === 'highest') return b.normalizedAmount - a.normalizedAmount;
          if (sortOrder === 'lowest') return a.normalizedAmount - b.normalizedAmount;
          return 0;
      });

      return filtered;
  },[activeIdsList, rowData, searchQuery, filterType, sortOrder, labels, archived]);

  const totalFilteredItems = processedItems.length;
  const totalPages = Math.ceil(totalFilteredItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = processedItems.slice(startIndex, startIndex + itemsPerPage);

  const idsLoading = activeTab === 'locks' ? locksLoading : vestingLoading;

  useEffect(() => { setCurrentPage(1); },[activeTab, itemsPerPage, searchQuery, sortOrder, filterType]);
  const goToNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const goToPrev = () => setCurrentPage((p) => Math.max(p - 1, 1));

  // --- CSV EXPORT HANDLER ---
  const handleExport = async () => {
    if (!publicClient || processedItems.length === 0) return;
    setIsExporting(true);

    try {
        const rows = [["ID", "Label", "Network ID", "Token Address", "Amount (Raw)", "Unlock Date", "Status"]];
        
        // HELPER: Micro-throttle to respect Public RPC rate limits
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        for (const item of processedItems) {
            const label = labels[item.fancyId] || "";
            if (!item.data) {
                // If data isn't cached by multicall, fetch it manually
                const data: any = await publicClient.readContract({
                    address: CONTRACT_ADDRESSES[item.chainId] as `0x${string}`,
                    abi: CONTRACT_ABI,
                    functionName: activeTab === 'locks' ? 'locks' : 'vestings',
                    args:[item.rawId]
                });
                
                const token = data[0]; 
                const amount = data[1]; 
                const dateVal = activeTab === 'locks' ? data[5] : (Number(data[5]) + Number(data[6]) + Number(data[7])); 
                const dateStr = new Date(Number(dateVal) * 1000).toISOString().split('T')[0];
                
                rows.push([item.fancyId, label, item.chainId.toString(), token, amount.toString(), dateStr, "Active"]);
                
                // THROTTLE: Wait 100ms before making the next RPC call
                await delay(100);
            } else {
                // If data is already cached from the UI render, use it instantly (No throttle needed)
                const token = item.data[0]; 
                const amount = item.data[1]; 
                const dateVal = activeTab === 'locks' ? item.data[5] : (Number(item.data[5]) + Number(item.data[6]) + Number(item.data[7])); 
                const dateStr = new Date(Number(dateVal) * 1000).toISOString().split('T')[0];
                rows.push([item.fancyId, label, item.chainId.toString(), token, amount.toString(), dateStr, "Active"]);
            }
        }

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `0xKeep_${activeTab}_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error("Export failed", e);
        alert("Export failed. Public RPC might be rate-limited. Try again in a minute.");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    // FIX: Using h-full and flex-col to force 100% height without body scrolling
    <main className="h-full flex flex-col px-6 md:px-12 py-10 max-w-7xl mx-auto w-full overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 shrink-0">
        <div>
          <h1 className="text-4xl md:text-5xl font-chakra font-bold text-white mb-2 tracking-tight">
            My <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Vaults</span>
          </h1>
        </div>
        {/* STATS AREA */}
        <div className="flex items-center gap-8 mt-4 md:mt-0">
            <div className="text-right">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9E] block mb-1">Active Locks</span>
                {/* UPDATED VARIABLE */}
                <span className="text-3xl font-chakra font-bold text-white">{activeLocksCount}</span>
            </div>
            <div className="text-right">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9E] block mb-1">Active Vestings</span>
                {/* UPDATED VARIABLE */}
                <span className="text-3xl font-chakra font-bold text-white">{activeVestingsCount}</span>
            </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 shrink-0">
          <div className="flex gap-2 bg-[#13131A] p-1.5 rounded-xl border border-white/5">
              <button onClick={() => setActiveTab('locks')} className={`px-6 py-2 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all ${activeTab === 'locks' ? 'bg-white text-black font-bold' : 'text-[#8B8B9E] hover:text-white'}`}>Liquidity Locks</button>
              <button onClick={() => setActiveTab('vesting')} className={`px-6 py-2 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all ${activeTab === 'vesting' ? 'bg-white text-black font-bold' : 'text-[#8B8B9E] hover:text-white'}`}>Vesting Schedules</button>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative min-w-[200px]">
                  <input type="text" placeholder="Search..." className="w-full bg-[#13131A] border border-white/5 rounded-lg pl-9 pr-3 py-2.5 text-[11px] text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                  <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
              </div>

              {/* UPDATED FILTER */}
              <div className="relative">
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="appearance-none bg-[#13131A] border border-white/5 rounded-lg pl-9 pr-8 py-2.5 text-[11px] text-[#8B8B9E] font-mono focus:outline-none cursor-pointer hover:text-white transition-colors">
                      <option value="all">All Items</option>
                      <option value="labeled">Labeled Only</option>
                      <option value="unlabeled">Unlabeled Only</option>
                  </select>
                  <Filter size={14} className="absolute left-3 top-3 text-zinc-500 pointer-events-none" />
                  <ChevronDownIcon className="absolute right-3 top-3 text-zinc-500 pointer-events-none w-3 h-3" />
              </div>

              {/* Sort */}
              <div className="relative">
                  <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="appearance-none bg-[#13131A] border border-white/5 rounded-lg pl-9 pr-8 py-2.5 text-[11px] text-[#8B8B9E] font-mono focus:outline-none cursor-pointer hover:text-white transition-colors">
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="highest">Highest Amount</option>
                      <option value="lowest">Lowest Amount</option>
                  </select>
                  <ArrowUpDown size={14} className="absolute left-3 top-3 text-zinc-500 pointer-events-none" />
                  <ChevronDownIcon className="absolute right-3 top-3 text-zinc-500 pointer-events-none w-3 h-3" />
              </div>

              <button onClick={handleExport} disabled={!isConnected || processedItems.length === 0 || isExporting} className="bg-[#13131A] border border-white/5 rounded-lg px-3 py-2.5 text-[#8B8B9E] hover:text-white transition-colors disabled:opacity-50">
                  {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
              </button>
          </div>
      </div>

      {/* TABLE AREA - FIX: Internal Scrolling */}
      <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* Table Header Wrapper (Synchronized scroll) */}
        <div className="overflow-auto flex-1 relative">
          <div className="min-w-[1000px]"> 
              {/* Sticky Header */}
              <div className="grid grid-cols-7 px-5 py-4 border-b border-[#1C1C26] text-[10px] font-mono text-[#555566] uppercase tracking-widest bg-[#0F0F14] sticky top-0 z-10">
                <div>No.</div>
                <div>ID / Label</div>
                <div>Network</div>
                <div>Token</div>
                <div>Amount</div>
                <div>Status</div>
                <div>Action</div>
              </div>

              {/* Table Body */}
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-[#555566] font-mono uppercase tracking-widest text-xs">
                    <p>Connect wallet to view vaults</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1C1C26]">
                    {idsLoading && <div className="p-12 flex justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>}

                    {activeTab === 'locks' && currentItems.map((item, idx) => (
                        <LockRow
                          key={item.fancyId}
                          lockId={item.rawId}
                          chainId={item.chainId}
                          index={startIndex + idx + 1}
                          prefetchedData={item.data}
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
                          {searchQuery ? "No matches found." : "No active vaults found."}
                        </div>
                    )}
                </div>
              )}
          </div>
        </div>

        {/* PAGINATION FOOTER (Sticky Bottom) */}
        {isConnected && processedItems.length > 0 && (
          <div className="px-6 py-4 bg-[#0F0F14] border-t border-[#1C1C26] flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-20">
             <div className="flex items-center gap-3">
                <span className="text-[#555566] font-mono text-[10px] uppercase tracking-widest">Rows:</span>
                <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-transparent border border-white/10 text-[#8B8B9E] font-mono text-[10px] rounded px-2 py-1 focus:outline-none cursor-pointer">
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
                  <button onClick={goToPrev} disabled={currentPage === 1} className="text-[#8B8B9E] hover:text-white disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                  <button onClick={goToNext} disabled={currentPage === totalPages} className="text-[#8B8B9E] hover:text-white disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                </div>
             </div>
          </div>
        )}
      </div>
    </main>
  );
}