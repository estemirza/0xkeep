'use client';

import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { parseId, getExplorerAddressLink, getExplorerTokenLink, CHAIN_NAMES } from "@/lib/formatter";
import { erc20Abi, formatUnits, isAddressEqual } from "viem";
import { Loader2, CheckCircle2, Copy, Twitter, Code, AlertTriangle, Lock, Info, X } from "lucide-react";
import { useState, useEffect } from "react";
import { isAddress } from "viem";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const TWITTER_HANDLE = "@0xkeep_official";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const InfoPopup = ({ title, description, onClose, className = "" }: {
  title: string; description: string; onClose: () => void; className?: string;
}) => (
  <div className={`absolute z-50 w-64 p-4 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 ${className}`} onClick={(e) => e.stopPropagation()}>
    <div className="flex justify-between items-start mb-2 border-b border-white/10 pb-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white">{title}</span>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-zinc-500 hover:text-white transition-colors"><X size={12} /></button>
    </div>
    <p className="text-xs text-zinc-400 font-sans leading-relaxed">{description}</p>
  </div>
);

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function VestingCertificatePage() {
  const { id } = useParams();
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  let rawId = BigInt(0);
  let targetChainId = 84532;
  let parseError = false;
  try {
    const parsed = parseId(id as string);
    rawId = parsed.rawId;
    targetChainId = parsed.chainId;
  } catch (e) {
    console.error(e);
    parseError = true;
  }

  const activeContract = CONTRACT_ADDRESSES[targetChainId];

  const [isCopied, setIsCopied] = useState(false);
  const [isEmbedCopied, setIsEmbedCopied] = useState(false);
  const [transferAddress, setTransferAddress] = useState("");
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'none' | 'transfer' | 'claim'>('none');

  const { data: vest, isLoading, isError, refetch } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'vestings',
    args: [rawId],
    chainId: targetChainId,
    query: { enabled: !!activeContract && !parseError },
  });

  const tokenAddress = vest ? vest[0] : undefined;
  const { data: tokenData } = useReadContracts({
    contracts: [{ address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: targetChainId }],
    query: { enabled: !!tokenAddress },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // FIX V2: refetch in useEffect, never during render
  useEffect(() => {
    if (isSuccess) {
      refetch();
      setTransferAddress("");
      setActiveAction('none');
    }
  }, [isSuccess, refetch]);

  // ── ERROR & LOADING STATES ────────────────────────────

  if (!activeContract || parseError) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">Invalid Certificate ID</p>
          <p className="text-[#555566] font-mono text-xs">This vesting ID does not exist or the chain is not supported.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#555566]" />
      </div>
    );
  }

  // FIX V5: Error state instead of infinite spinner
  if (isError || !vest) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">Vesting Not Found</p>
          <p className="text-[#555566] font-mono text-xs">This vesting ID does not exist on {CHAIN_NAMES[targetChainId] || "this network"}.</p>
        </div>
      </div>
    );
  }

  // ── DATA ─────────────────────────────────────────────
  const tokenSymbol  = tokenData?.[0]?.result?.toString() || "ERC20";
  const decimals     = Number(vest[3] || 18);
  const totalRaw     = vest[1];   // uint96 — raw BigInt
  const claimedRaw   = vest[4];   // uint96 — raw BigInt
  const startTime    = Number(vest[5]);
  const cliffDuration = Number(vest[6]);
  const duration     = Number(vest[7]);

  const totalAmount   = Number(formatUnits(totalRaw, decimals));
  const claimedAmount = Number(formatUnits(claimedRaw, decimals));

  const now = Math.floor(Date.now() / 1000);
  const cliffEnd = startTime + cliffDuration;
  const vestEnd  = cliffEnd + duration;    // FIX V7: end = cliff end + duration

  const inCliff      = now < cliffEnd;
  const isCompleted  = claimedRaw >= totalRaw;

  // FIX V6: Replicate contract's exact integer math using BigInt
  // Contract formula: (amount/duration)*timePassed + (amount%duration)*timePassed/duration
  let claimableNow = 0;
  if (!inCliff && !isCompleted) {
    const timePassedSinceCliff = BigInt(Math.min(now - cliffEnd, duration));
    const amt = BigInt(totalRaw);
    const dur = BigInt(duration);
    const totalUnlockedRaw = dur > BigInt(0)
      ? (amt / dur) * timePassedSinceCliff + ((amt % dur) * timePassedSinceCliff) / dur
      : amt;
    const claimableRaw = totalUnlockedRaw - BigInt(claimedRaw);
    claimableNow = Number(formatUnits(claimableRaw > BigInt(0) ? claimableRaw : BigInt(0), decimals));
  }

  // Progress bar percentages
  const percentClaimed  = Math.min(100, totalAmount > 0 ? (claimedAmount / totalAmount) * 100 : 0);
  const totalSpan       = cliffDuration + duration;
  const timeElapsed     = Math.max(0, now - startTime);
  const percentTime     = Math.min(100, totalSpan > 0 ? (timeElapsed / totalSpan) * 100 : 0);

  // FIX V3: Use isAddressEqual for checksum-safe owner comparison
  const isOwner = address && vest[2]
    ? isAddressEqual(address, vest[2] as `0x${string}`)
    : false;

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-GB');

  const isTransferAddressFilled = transferAddress.trim().length > 0;
  const isInvalidTransfer       = isTransferAddressFilled && !isAddress(transferAddress);

  // ── ACTIONS ───────────────────────────────────────────
  const executeAction = (action: () => void) => {
    if (chain?.id !== targetChainId) {
      if (confirm(`Switch network to ${CHAIN_NAMES[targetChainId] || "the correct network"}?`)) {
        if (switchChain) switchChain({ chainId: targetChainId });
      }
      return;
    }
    action();
  };

  const handleClaim = () => executeAction(() => {
    setActiveAction('claim');
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'claimVesting', args: [rawId] });
  });

  const handleTransfer = () => executeAction(() => {
    if (!transferAddress || isInvalidTransfer) return;
    setActiveAction('transfer');
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'transferVestingOwnership', args: [rawId, transferAddress as `0x${string}`] });
  });

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true); setTimeout(() => setter(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = `I just started a vesting schedule on ${TWITTER_HANDLE}.\n\n📈 Vesting ID: #${id}\n💎 Total: ${totalAmount.toLocaleString()} ${tokenSymbol}\n\nVerify proof here:`;
    const url  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const handleEmbed = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/vesting/${id}" width="100%" height="220" style="max-width: 400px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setIsEmbedCopied(true); setTimeout(() => setIsEmbedCopied(false), 2000);
  };

  const toggleInfo = (key: string) => setOpenInfo(openInfo === key ? null : key);

  // ── STATUS ────────────────────────────────────────────
  // FIX V10: Three states — In Cliff / Active / Completed
  const statusLabel = isCompleted ? 'Completed' : inCliff ? 'In Cliff' : 'Active';
  const statusColor = isCompleted
    ? 'text-[#555566]'
    : inCliff
    ? 'text-amber-400'
    : 'text-white';
  const statusDot = isCompleted
    ? 'bg-[#555566]'
    : inCliff
    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
    : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]';

  // ── RENDER ────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0B0B0F] pb-20" onClick={() => setOpenInfo(null)}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 md:px-6 mt-12 flex flex-col items-center">

        {/* HEADER */}
        <div className="flex flex-col items-center mb-12 text-center">
          
            <a href={getExplorerAddressLink(targetChainId, activeContract)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full border border-white/5 bg-[#13131A] hover:bg-[#1A1A24] transition-colors cursor-pointer group"
          >
            <div className="bg-purple-500 rounded-full p-0.5"><CheckCircle2 size={10} className="text-white" /></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8B8B9E] group-hover:text-white transition-colors">Verified by 0xKeep</span>
          </a>
          <h1 className="text-3xl md:text-4xl font-chakra font-bold text-white uppercase tracking-tight mb-2">Vesting Certificate</h1>
          <p className="text-[#555566] font-mono text-xs uppercase tracking-widest">Certificate ID: {id}</p>
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-6 mb-6">

          {/* LEFT COLUMN */}
          <div className="flex-1 bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden">

            {/* Status + Amount */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566] block mb-2">Status</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot}`}></div>
                  <span className={`text-xl font-chakra font-bold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
                </div>
                {inCliff && (
                  <p className="text-amber-400/70 font-mono text-[10px] mt-1">
                    Cliff ends {formatDate(cliffEnd)}
                  </p>
                )}
              </div>
              <div className="md:text-right">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566] block mb-2">Total Allocation</span>
                <div className="flex items-baseline gap-2 md:justify-end">
                  <p className="text-3xl md:text-4xl font-mono text-white break-all">
                    {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xl font-mono text-white">{tokenSymbol}</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-10">
              <div className="relative h-2 bg-[#1C1C26] rounded-full overflow-hidden mb-3">
                <div className="absolute top-0 left-0 h-full bg-[#2A2A3A]" style={{ width: `${percentTime}%` }} />
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${percentClaimed}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#555566] uppercase tracking-widest mb-6">
                <span>Start: {formatDate(startTime)}</span>
                {cliffDuration > 0 && <span className="text-amber-400/70">Cliff: {formatDate(cliffEnd)}</span>}
                <span>End: {formatDate(vestEnd)}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-mono text-white">
                    {claimedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#555566] mt-1">Claimed So Far</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-mono text-white">
                    {claimableNow.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#555566] mt-1">
                    {inCliff ? "Available After Cliff" : "Available to Claim"}
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Links */}
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center border-b border-[#1C1C26] pb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566]">Beneficiary</span>
                
                  <a href={getExplorerAddressLink(targetChainId, vest[2])}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-mono text-[11px] md:text-xs transition-colors truncate max-w-[150px] md:max-w-xs"
                >
                  {vest[2]}
                </a>
              </div>
              <div className="flex justify-between items-center border-b border-[#1C1C26] pb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566]">Token Contract</span>
                
                  <a href={getExplorerTokenLink(targetChainId, vest[0])}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-mono text-[11px] md:text-xs transition-colors truncate max-w-[150px] md:max-w-xs"
                >
                  {vest[0]}
                </a>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between pt-2">
              <div className="flex items-center gap-6">
                <button onClick={() => copyToClipboard(window.location.href, setIsCopied)} className="flex items-center gap-2 text-[#8B8B9E] hover:text-white transition-colors">
                  {isCopied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                  <span className="font-mono text-[10px] uppercase tracking-widest">{isCopied ? "Copied" : "Copy Link"}</span>
                </button>
                <button onClick={handleShareTwitter} className="flex items-center gap-2 text-[#8B8B9E] hover:text-white transition-colors">
                  <Twitter size={14} />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Share on X</span>
                </button>
                <button onClick={handleEmbed} className="flex items-center gap-2 text-[#8B8B9E] hover:text-white transition-colors">
                  {isEmbedCopied ? <CheckCircle2 size={14} className="text-green-400" /> : <Code size={14} />}
                  <span className="font-mono text-[10px] uppercase tracking-widest">{isEmbedCopied ? "Copied Code" : "Embed"}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[#0B0B0F] px-3 py-1.5 rounded-full border border-[#1C1C26] mt-4 sm:mt-0">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
                <span className="text-blue-400 font-mono text-[9px] uppercase tracking-wider">{CHAIN_NAMES[targetChainId] || "UNKNOWN"}</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: OWNER CONTROLS */}
          <div className="w-full lg:w-[380px] bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6 flex flex-col justify-between shrink-0 h-fit">
            <h3 className="font-mono uppercase text-xs text-[#8B8B9E] tracking-widest mb-6 text-center">Owner Control</h3>

            <div className="relative flex-1 flex flex-col -mx-2 px-2">
              {(!isOwner || isCompleted) && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#13131A]/60 backdrop-blur-[2px] rounded-xl border border-white/5">
                  <Lock size={24} className="text-[#555566] mb-3" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">Restricted</span>
                  <span className="font-sans text-[10px] text-[#8B8B9E] mt-2 text-center px-4 leading-relaxed">
                    {isCompleted ? "This vesting schedule is fully completed." : "Only the connected owner wallet can access these controls."}
                  </span>
                </div>
              )}

              <div className={`space-y-6 flex-1 flex flex-col transition-all duration-300 ${(!isOwner || isCompleted) ? 'opacity-30 blur-[2px] pointer-events-none select-none' : ''}`}>

                {/* Transfer */}
                <div className="space-y-2 border border-[#1C1C26] p-4 rounded-xl bg-[#0B0B0F]/50">
                  <div className="flex justify-between items-center mb-4 relative">
                    <div className="flex items-center gap-2 text-[#E0A831]">
                      <AlertTriangle size={14} />
                      <span className="font-mono uppercase text-xs tracking-widest">Transfer Ownership</span>
                    </div>
                    <Info size={14} className="text-[#555566] hover:text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('transfer'); }} />
                    {openInfo === 'transfer' && (
                      <InfoPopup title="Transfer Ownership" description="Permanently hand over the remaining vesting schedule to another wallet. The new owner receives all future claims." className="top-6 right-0" onClose={() => setOpenInfo(null)} />
                    )}
                  </div>
                  <input
                    type="text" placeholder="0x..." disabled={!isOwner || isCompleted}
                    value={transferAddress}
                    className={`w-full bg-[#13131A] border border-[#1C1C26] rounded-lg p-3 text-white font-mono text-xs focus:outline-none disabled:opacity-50 mb-1 ${isInvalidTransfer ? 'border-red-500/50' : 'border-[#1C1C26] focus:border-blue-500'}`}
                    onChange={(e) => setTransferAddress(e.target.value)}
                  />
                  {isInvalidTransfer && <p className="text-red-400 text-[9px] font-mono uppercase tracking-widest mb-3">Invalid Address</p>}
                  <button
                    onClick={handleTransfer}
                    disabled={!isOwner || isCompleted || isPending || !transferAddress || isInvalidTransfer}
                    className="w-full py-2.5 mt-2 rounded-full border border-white/10 text-xs font-mono uppercase tracking-widest text-[#8B8B9E] hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending && activeAction === 'transfer' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "Transfer"}
                  </button>
                </div>

                {/* Claim */}
                <div className="mt-6 pt-6 border-t border-[#1C1C26]">
                  <div className="text-center mb-4">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#555566] mb-1">
                      {inCliff ? "Unlocks After Cliff" : "Available to Claim"}
                    </p>
                    <p className="text-2xl font-mono text-white">
                      {claimableNow.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </p>
                    <p className="text-[#555566] font-mono text-xs mt-1">{tokenSymbol}</p>
                  </div>
                  <button
                    onClick={handleClaim}
                    disabled={!isOwner || claimableNow <= 0 || isPending || inCliff}
                    className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-mono text-sm uppercase tracking-widest transition-all ${(!isOwner || claimableNow <= 0 || inCliff) ? 'bg-[#1A1A24] text-[#555566] cursor-not-allowed border border-white/5' : 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:brightness-110'}`}
                  >
                    {isPending && activeAction === 'claim' ? <Loader2 className="animate-spin" size={16} /> : inCliff ? "In Cliff Period" : "Claim Tokens"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TRUST SECTION */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0A1A10] border border-[#103018] p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-green-500" />
              <span className="text-sm font-bold text-white font-sans">What This Proves</span>
            </div>
            <ul className="text-xs text-zinc-400 space-y-2 ml-6 list-disc marker:text-green-800 font-sans">
              <li>Tokens are vesting according to an immutable schedule.</li>
              <li>Claiming is mathematically enforced by the contract.</li>
              <li>No admin can stop or alter the distribution.</li>
            </ul>
          </div>
          <div className="bg-[#1A150A] border border-[#302010] p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-[#E0A831]" />
              <span className="text-sm font-bold text-white font-sans">What This Does NOT Prove</span>
            </div>
            <ul className="text-xs text-zinc-400 space-y-2 ml-6 list-disc marker:text-[#E0A831]/50 font-sans">
              <li>This does not guarantee the token has value.</li>
              <li>This does not prevent the team from selling other unlocked wallets.</li>
              <li>0xKeep does not endorse this project.</li>
            </ul>
          </div>
        </div>

      </div>
    </main>
  );
}