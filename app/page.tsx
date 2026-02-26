'use client';

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Lock, Loader2, ChevronLeft, ChevronRight, Search, Download, Filter, ArrowUpDown } from "lucide-react";
import { useAccount, useReadContract, usePublicClient, useReadContracts } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { LockRow, VestingRow } from "@/components/DashboardRows";
import { useLabels } from "@/hooks/useLabels";
import { formatLockId, formatVestingId } from "@/lib/formatter";
import { formatUnits } from "viem";

// Helper
const getContractAddress = (chainId?: number) => {
  return CONTRACT_ADDRESSES[chainId || 84532] || CONTRACT_ADDRESSES[84532];
};

// Small Icon Helper
const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'locks' | 'vesting'>('locks');
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const activeContract = getContractAddress(chain?.id);
  const { labels } = useLabels();

  // --- SEARCH & FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  // UPDATED: Added highest/lowest
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'labeled' | 'unlabeled'>('all');
  
  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  // 1. Fetch List of IDs
  const { data: lockIds, isLoading: locksLoading } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'getUserLocks',
    args: address ? [address] : undefined,
    query: { enabled: !!address && activeTab === 'locks' }
  });

  const { data: vestingIds, isLoading: vestingLoading } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'getUserVestings',
    args: address ? [address] : undefined,
    query: { enabled: !!address && activeTab === 'vesting' }
  });

  // 2. Prepare Unique IDs
  const rawIds = activeTab === 'locks' ? lockIds : vestingIds;
  const idsLoading = activeTab === 'locks' ? locksLoading : vestingLoading;
  const uniqueIds = useMemo(() => rawIds ? Array.from(new Set(rawIds)) : [], [rawIds]);

  // 3. NEW: Batch Fetch Data for Sorting (Amount)
  // We need to fetch the struct for every ID to sort by amount. 
  // Since user lists aren't massive (usually < 100), this is performant enough.
  const { data: rowData } = useReadContracts({
    contracts: uniqueIds.map(id => ({
        address: activeContract,
        abi: CONTRACT_ABI,
        functionName: activeTab === 'locks' ? 'locks' : 'vestings',
        args: [id],
        chainId: chain?.id
    })),
    query: { enabled: uniqueIds.length > 0 }
  });

  // --- FILTERING & SORTING LOGIC ---
  const processedIds = useMemo(() => {
      // Create an array of objects to sort: { id, amount }
      const mapped = uniqueIds.map((id, index) => {
          const data = rowData?.[index]?.result as any; // Type 'any' used because structs differ but indices align here
          // V11 Structs: 
          // Lock: amount is index [1], decimals [3]
          // Vest: totalAmount is index [1], decimals [3]
          let normalizedAmount = 0;
          
          if (data) {
              const rawAmount = data[1] || BigInt(0);
              const decimals = data[3] || 18;
              normalizedAmount = Number(formatUnits(rawAmount, decimals));
          }
          
          return { id, normalizedAmount };
      });

      // Filter
      const filtered = mapped.filter(item => {
          const chainId = chain?.id || 84532;
          const fancyId = activeTab === 'locks' ? formatLockId(item.id, chainId) : formatVestingId(item.id, chainId);
          const label = labels[fancyId] || "";

          if (filterType === 'labeled' && !label) return false;
          if (filterType === 'unlabeled' && label) return false;

          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return fancyId.toLowerCase().includes(query) || label.toLowerCase().includes(query);
      });

      // Sort
      filtered.sort((a, b) => {
          if (sortOrder === 'newest') return Number(b.id - a.id); // Higher ID = Newer
          if (sortOrder === 'oldest') return Number(a.id - b.id);
          if (sortOrder === 'highest') return b.normalizedAmount - a.normalizedAmount;
          if (sortOrder === 'lowest') return a.normalizedAmount - b.normalizedAmount;
          return 0;
      });

      return filtered.map(item => item.id);
  }, [uniqueIds, rowData, searchQuery, filterType, sortOrder, activeTab, chain?.id, labels]);

  // 4. Pagination Slice
  const totalItems = processedIds.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentIds = processedIds.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [activeTab, itemsPerPage, searchQuery, sortOrder, filterType]);

  // Handlers
  const goToNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const goToPrev = () => setCurrentPage((p) => Math.max(p - 1, 1));

  // --- CSV EXPORT HANDLER ---
  const handleExport = async () => {
    if (!publicClient || uniqueIds.length === 0) return;
    setIsExporting(true);

    try {
        const rows = [["ID", "Label", "Network", "Token Address", "Amount (Raw)", "Unlock Date", "Status"]];
        const chainId = chain?.id || 84532;

        for (const id of uniqueIds) {
            const fancyId = activeTab === 'locks' ? formatLockId(id, chainId) : formatVestingId(id, chainId);
            const label = labels[fancyId] || "";
            
            const data: any = await publicClient.readContract({
                address: activeContract,
                abi: CONTRACT_ABI,
                functionName: activeTab === 'locks' ? 'locks' : 'vestings',
                args: [id]
            });
            
            const token = data[0]; // V11 Index 0
            const amount = data[1]; // V11 Index 1
            const dateVal = activeTab === 'locks' ? data[5] : (Number(data[5]) + Number(data[6]) + Number(data[7])); // End Date
            
            const dateStr = new Date(Number(dateVal) * 1000).toISOString().split('T')[0];
            const status = "Active"; 

            rows.push([fancyId, label, chain?.name || "Base", token, amount.toString(), dateStr, status]);
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
        alert("Export failed. Check console.");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030305] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#030305] to-[#030305]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6 md:gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-mono uppercase font-normal tracking-tight text-white mb-2">Dashboard</h1>
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <p className="text-zinc-400 font-mono text-xs uppercase tracking-widest">Welcome back, Architect.</p>
                {isConnected ? (
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,1)] animate-pulse"></div>
                        <span className="text-blue-400 font-mono text-[10px] uppercase tracking-wider">
                            {chain?.name || "Unknown Network"}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,1)]"></div>
                        <span className="text-red-400 font-mono text-[10px] uppercase tracking-wider">Not Connected</span>
                    </div>
                )}
            </div>
          </div>
          
          <Link href="/create" className="w-full md:w-auto btn-glow flex items-center gap-2 justify-center">
            <Lock size={14} />
            <span>Create New Lock</span>
          </Link>
        </div>

        {/* TOOLBAR: Tabs + Search + Sort + Export */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
            
            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full xl:w-fit backdrop-blur-md border border-white/10 overflow-x-auto">
                <button onClick={() => setActiveTab('locks')} className={`flex-1 xl:flex-none px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'locks' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}>Liquidity Locks</button>
                <button onClick={() => setActiveTab('vesting')} className={`flex-1 xl:flex-none px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'vesting' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}>Vesting Schedules</button>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search size={14} className="absolute left-3 top-2.5 text-zinc-600" />
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                    <select 
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="appearance-none bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/30 cursor-pointer transition-colors"
                    >
                        <option value="all">All Items</option>
                        <option value="labeled">Labeled Only</option>
                        <option value="unlabeled">Unlabeled Only</option>
                    </select>
                    <Filter size={14} className="absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
                    <ChevronDownIcon className="absolute right-3 top-2.5 text-zinc-500 pointer-events-none w-3 h-3" />
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                    <select 
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as any)}
                        className="appearance-none bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/30 cursor-pointer transition-colors"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="highest">Highest Amount</option>
                        <option value="lowest">Lowest Amount</option>
                    </select>
                    <ArrowUpDown size={14} className="absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
                    <ChevronDownIcon className="absolute right-3 top-2.5 text-zinc-500 pointer-events-none w-3 h-3" />
                </div>

                {/* Export Button */}
                <button 
                    onClick={handleExport}
                    disabled={!isConnected || uniqueIds.length === 0 || isExporting}
                    className="btn-ghost px-3 py-2 flex items-center gap-2 disabled:opacity-50 h-[34px]"
                    title="Export CSV"
                >
                    {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                </button>
            </div>
        </div>

        {/* Table Area */}
        <div className="glass-card rounded-2xl overflow-hidden min-h-[400px] flex flex-col justify-between">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]"> 
                <div className="grid grid-cols-6 p-4 border-b border-white/5 bg-white/[0.02] text-xs font-mono text-zinc-500 uppercase tracking-widest">
                  <div>ID / Label</div>
                  <div>Network</div>
                  <div>Owner</div>
                  <div>Amount</div>
                  <div>Token</div>
                  <div>Status</div>
                </div>

                {!isConnected ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-zinc-500 font-mono uppercase tracking-widest text-xs">
                      <Lock className="w-12 h-12 mb-4 opacity-20" />
                      <p>Connect wallet to view protocol assets</p>
                  </div>
                ) : (
                  <div>
                      {idsLoading ? (
                          <div className="p-12 flex justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>
                      ) : null}

                      {activeTab === 'locks' && currentIds.map((id) => <LockRow key={id} lockId={id} />)}
                      {activeTab === 'vesting' && currentIds.map((id) => <VestingRow key={id} vestingId={id} />)}

                      {!idsLoading && processedIds.length === 0 && (
                          <div className="p-12 text-center text-zinc-500 font-mono uppercase tracking-widest text-xs">
                            {searchQuery ? "No matches found." : (filterType !== 'all' ? `No ${filterType} ${activeTab} found.` : `No active ${activeTab} found.`)}
                          </div>
                      )}
                  </div>
                )}
            </div>
          </div>

          {/* PAGINATION */}
          {isConnected && processedIds.length > 0 && (
            <div className="border-t border-white/5 bg-white/[0.02] p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-3">
                  <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Rows:</span>
                  <select 
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-black/40 border border-white/10 text-white font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-white/30 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
               </div>

               <div className="flex items-center gap-4">
                  <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <div className="flex gap-1">
                    <button onClick={goToPrev} disabled={currentPage === 1} className="p-1 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={16} /></button>
                    <button onClick={goToNext} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={16} /></button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}