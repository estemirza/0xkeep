'use client';

import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { parseId, getExplorerAddressLink, getExplorerTokenLink, getExplorerTxLink, CHAIN_NAMES } from "@/lib/formatter";
import { erc20Abi, formatUnits, isAddressEqual } from "viem";
import { Loader2, ShieldCheck, AlertTriangle, Calendar, CheckCircle2, Copy, Twitter, Code, ExternalLink, Lock, Info, X } from "lucide-react";
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
export default function LockCertificatePage() {
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

  const [extendDate, setExtendDate] = useState("");
  const [transferAddress, setTransferAddress] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isEmbedCopied, setIsEmbedCopied] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'none' | 'extend' | 'transfer' | 'withdraw'>('none');

  const { data: lock, isLoading, isError, refetch } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'locks',
    args: [rawId],
    chainId: targetChainId,
    query: { enabled: !!activeContract && !parseError },
  });

  const tokenAddress = lock ? lock[0] : undefined;
  const { data: tokenData } = useReadContracts({
    contracts: [{ address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: targetChainId }],
    query: { enabled: !!tokenAddress },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // FIX L2: Move refetch into useEffect — never call side effects during render
  useEffect(() => {
    if (isSuccess) {
      refetch();
      setTransferAddress(""); // FIX L5: Clear transfer input after success
      setActiveAction('none');
    }
  }, [isSuccess, refetch]);

  // ── ERROR & LOADING STATES ────────────────────────────

  // FIX L3: Guard when contract address is undefined
  if (!activeContract || parseError) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">Invalid Certificate ID</p>
          <p className="text-[#555566] font-mono text-xs">This lock ID does not exist or the chain is not supported.</p>
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

  // FIX L9: Show error state instead of infinite spinner
  if (isError || !lock) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm uppercase tracking-widest mb-2">Lock Not Found</p>
          <p className="text-[#555566] font-mono text-xs">This lock ID does not exist on {CHAIN_NAMES[targetChainId] || "this network"}.</p>
        </div>
      </div>
    );
  }

  // ── DATA ─────────────────────────────────────────────
  const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
  const decimals    = Number(lock[3] || 18);
  const amount      = Number(formatUnits(lock[1], decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const unlockDate  = new Date(Number(lock[5]) * 1000);

  // FIX L4: Use isAddressEqual to handle checksum differences
  const isOwner    = address && lock[2] ? isAddressEqual(address, lock[2] as `0x${string}`) : false;
  const isWithdrawn = lock[4];
  const isUnlocked  = Date.now() > unlockDate.getTime();

  // ── VALIDATIONS ───────────────────────────────────────
  const selectedExtend    = extendDate ? new Date(extendDate) : null;
  const isExtensionInvalid = selectedExtend
    ? (selectedExtend.getTime() <= unlockDate.getTime() || selectedExtend.getTime() <= Date.now())
    : false;
  const isTransferAddressFilled = transferAddress.trim().length > 0;
  const isInvalidTransfer       = isTransferAddressFilled && !isAddress(transferAddress);

  // ── STATUS DISPLAY ────────────────────────────────────
  let statusColor = "text-green-400";
  let statusBg    = "bg-green-400 shadow-[0_0_8px_#4ade80]";
  let statusText  = "LOCKED";
  if (isWithdrawn) {
    statusColor = "text-[#555566]"; statusBg = "bg-[#555566]"; statusText = "WITHDRAWN";
  } else if (isUnlocked) {
    statusColor = "text-green-400"; statusBg = "bg-green-400 shadow-[0_0_8px_#4ade80]"; statusText = "UNLOCKED";
  }

  // ── ACTIONS ───────────────────────────────────────────
  const executeAction = (action: () => void) => {
    if (chain?.id !== targetChainId) {
      if (confirm(`This lock is on ${CHAIN_NAMES[targetChainId] || "another network"}. Switch network to interact?`)) {
        if (switchChain) switchChain({ chainId: targetChainId });
      }
      return;
    }
    action();
  };

  const handleWithdraw = () => executeAction(() => {
    setActiveAction('withdraw');
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'withdrawLock', args: [rawId] });
  });

  const handleExtend = () => executeAction(() => {
    if (!extendDate || isExtensionInvalid) return;
    setActiveAction('extend');
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'extendLock', args: [rawId, BigInt(Math.floor(new Date(extendDate).getTime() / 1000))] });
  });

  const handleTransfer = () => executeAction(() => {
    if (!transferAddress || isInvalidTransfer) return;
    setActiveAction('transfer');
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'transferLockOwnership', args: [rawId, transferAddress as `0x${string}`] });
  });

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true); setTimeout(() => setter(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = `I just secured liquidity on ${TWITTER_HANDLE}.\n\n🔒 Lock ID: #${id}\n💎 Amount: ${amount} ${tokenSymbol}\n\nVerify proof here:`;
    const url  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const handleEmbed = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/lock/${id}" width="100%" height="220" style="max-width: 400px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setIsEmbedCopied(true); setTimeout(() => setIsEmbedCopied(false), 2000);
  };

  const toggleInfo = (key: string) => setOpenInfo(openInfo === key ? null : key);

  // ── RENDER ────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0B0B0F] pb-20" onClick={() => setOpenInfo(null)}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 md:px-6 mt-12 flex flex-col items-center">

        {/* HEADER */}
        <div className="flex flex-col items-center mb-12 text-center">
          {/* FIX L8: Explorer link uses correct chain */}
          
            <a href={getExplorerAddressLink(targetChainId, activeContract)}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full border border-white/5 bg-[#13131A] hover:bg-[#1A1A24] transition-colors cursor-pointer group"
          >
            <div className="bg-purple-500 rounded-full p-0.5"><CheckCircle2 size={10} className="text-white" /></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8B8B9E] group-hover:text-white transition-colors">Verified by 0xKeep</span>
          </a>
          <h1 className="text-4xl md:text-5xl font-chakra font-bold text-white uppercase tracking-tight mb-2">Lock Certificate</h1>
          <p className="text-[#555566] font-mono text-xs uppercase tracking-widest">Certificate ID: {id}</p>
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-6 mb-6">

          {/* LEFT COLUMN */}
          <div className="flex-1 bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6 md:p-8 relative overflow-hidden flex flex-col justify-between">
            {isWithdrawn && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 font-mono uppercase text-xl tracking-widest text-zinc-500">
                Asset Withdrawn
              </div>
            )}

            {/* Status Row */}
            <div className="flex justify-between items-start mb-10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566] block mb-2">Status</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusBg}`}></div>
                  <span className={`text-xl font-chakra font-bold uppercase tracking-wide ${statusColor}`}>{statusText}</span>
                </div>
              </div>
            </div>

            {/* Core Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#555566] mb-2">Locked Amount</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-mono text-white break-all">{amount}</p>
                  <p className="text-xl font-mono text-white">{tokenSymbol}</p>
                </div>
              </div>
              <div className="md:text-right">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#555566] mb-2">Unlock Date</p>
                <p className="text-2xl font-mono text-white">{unlockDate.toLocaleDateString('en-GB')}</p>
                <p className="text-[#555566] font-mono text-xs mt-1">{unlockDate.toLocaleTimeString('en-GB')}</p>
              </div>
            </div>

            {/* Metadata Links — FIX L1: all links use correct chain explorer */}
            <div className="space-y-4 mb-10">
              <div className="flex justify-between items-center border-b border-[#1C1C26] pb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566]">Beneficiary</span>
                
                  <a href={getExplorerAddressLink(targetChainId, lock[2])}
                  target="_blank" rel="noreferrer"
                  className="text-purple-400 hover:text-purple-300 font-mono text-[11px] md:text-xs transition-colors truncate max-w-[200px] md:max-w-xs"
                >
                  {lock[2]}
                </a>
              </div>
              <div className="flex justify-between items-center border-b border-[#1C1C26] pb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#555566]">Token Contract</span>
                
                  <a href={getExplorerTokenLink(targetChainId, lock[0])}
                  target="_blank" rel="noreferrer"
                  className="text-purple-400 hover:text-purple-300 font-mono text-[11px] md:text-xs transition-colors truncate max-w-[200px] md:max-w-xs"
                >
                  {lock[0]}
                </a>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between pt-2">
              <div className="flex items-center gap-6">
                <button onClick={() => copyToClipboard(window.location.href, setIsCopied)} className="flex items-center gap-2 text-[#8B8B9E] hover:text-white transition-colors group">
                  {isCopied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                  <span className="font-mono text-[10px] uppercase tracking-widest">{isCopied ? "Copied" : "Copy Link"}</span>
                </button>
                <button onClick={handleShareTwitter} className="flex items-center gap-2 text-[#8B8B9E] hover:text-white transition-colors group">
                  <Twitter size={14} className="group-hover:text-blue-400" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Share on X</span>
                </button>
                <button onClick={handleEmbed} className="flex items-center gap-2 text-[#8B8B9E] hover:text-white transition-colors group">
                  {isEmbedCopied ? <CheckCircle2 size={14} className="text-green-400" /> : <Code size={14} className="group-hover:text-orange-400" />}
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
          <div className="w-full lg:w-[380px] bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6 shrink-0 flex flex-col h-fit">
            <h3 className="font-mono uppercase text-xs text-[#8B8B9E] tracking-widest mb-6 text-center">Owner Control</h3>

            <div className="relative flex-1 flex flex-col -mx-2 px-2">
              {(!isOwner || isWithdrawn) && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#13131A]/60 backdrop-blur-[2px] rounded-xl border border-white/5">
                  <Lock size={24} className="text-[#555566] mb-3" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-300">Restricted</span>
                  <span className="font-sans text-[10px] text-[#8B8B9E] mt-2 text-center px-4 leading-relaxed">
                    {isWithdrawn ? "This vault has already been withdrawn." : "Only the connected owner wallet can access these controls."}
                  </span>
                </div>
              )}

              <div className={`space-y-6 flex-1 flex flex-col transition-all duration-300 ${(!isOwner || isWithdrawn) ? 'opacity-30 blur-[2px] pointer-events-none select-none' : ''}`}>

                {/* Transfer */}
                <div className="space-y-2 border border-[#1C1C26] p-4 rounded-xl bg-[#0B0B0F]/50">
                  <div className="flex justify-between items-center mb-4 relative">
                    <div className="flex items-center gap-2 text-[#E0A831]">
                      <AlertTriangle size={14} />
                      <span className="font-mono uppercase text-xs tracking-widest">Transfer Ownership</span>
                    </div>
                    <Info size={14} className="text-[#555566] hover:text-white transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('transfer'); }} />
                    {openInfo === 'transfer' && (
                      <InfoPopup title="Transfer Ownership" description="Permanently hand over control of this lock to another wallet. This action is irreversible." className="top-6 right-0" onClose={() => setOpenInfo(null)} />
                    )}
                  </div>
                  <input
                    type="text" placeholder="0x..." disabled={!isOwner || isWithdrawn}
                    value={transferAddress}
                    className={`w-full bg-[#13131A] border rounded-lg p-3 text-white font-mono text-xs focus:outline-none disabled:opacity-50 mb-1 ${isInvalidTransfer ? 'border-red-500/50' : 'border-[#1C1C26] focus:border-purple-500'}`}
                    onChange={(e) => setTransferAddress(e.target.value)}
                  />
                  {isInvalidTransfer && <p className="text-red-400 text-[9px] font-mono uppercase tracking-widest mb-3">Invalid Address</p>}
                  <button
                    onClick={handleTransfer}
                    disabled={!isOwner || isWithdrawn || isPending || !transferAddress || isInvalidTransfer}
                    className="w-full py-2.5 mt-2 rounded-full border border-white/10 text-xs font-mono uppercase tracking-widest text-[#8B8B9E] hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* FIX L6: Check activeAction so only this button spins */}
                    {isPending && activeAction === 'transfer' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "Transfer"}
                  </button>
                </div>

                {/* Extend */}
                <div className="space-y-2 border border-[#1C1C26] p-4 rounded-xl bg-[#0B0B0F]/50">
                  <div className="flex justify-between items-center mb-4 relative">
                    <div className="flex items-center gap-2 text-[#E0A831]">
                      <AlertTriangle size={14} />
                      <span className="font-mono uppercase text-xs tracking-widest">Extend Duration</span>
                    </div>
                    <Info size={14} className="text-[#555566] hover:text-white transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('extend'); }} />
                    {openInfo === 'extend' && (
                      <InfoPopup title="Extend Duration" description="Increase the time tokens remain locked. You cannot reduce the lock time." className="top-6 right-0" onClose={() => setOpenInfo(null)} />
                    )}
                  </div>
                  <div className="relative mb-1">
                    <input
                      type="datetime-local" disabled={!isOwner || isWithdrawn}
                      className={`w-full bg-[#13131A] border rounded-lg p-3 text-white font-mono text-xs focus:outline-none disabled:opacity-50 ${isExtensionInvalid ? 'border-red-500/50' : 'border-[#1C1C26] focus:border-purple-500'}`}
                      onChange={(e) => setExtendDate(e.target.value)}
                    />
                    <Calendar className="absolute right-3 top-3 text-[#555566] pointer-events-none" size={14} />
                  </div>
                  {isExtensionInvalid && <p className="text-red-400 text-[9px] font-mono uppercase tracking-widest mb-3">Must be later than current unlock date</p>}
                  <button
                    onClick={handleExtend}
                    disabled={!isOwner || isWithdrawn || isPending || !extendDate || isExtensionInvalid}
                    className="w-full py-2.5 mt-2 rounded-full border border-white/10 text-xs font-mono uppercase tracking-widest text-[#8B8B9E] hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending && activeAction === 'extend' ? <Loader2 className="animate-spin mx-auto" size={14} /> : "Extend"}
                  </button>
                </div>

                {/* Withdraw */}
                <div className="mt-auto pt-6 border-t border-[#1C1C26]">
                  <button
                    onClick={handleWithdraw}
                    disabled={!isOwner || !isUnlocked || isWithdrawn || isPending}
                    className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-mono text-sm uppercase tracking-widest transition-all ${(!isOwner || !isUnlocked || isWithdrawn) ? 'bg-[#1A1A24] text-[#555566] cursor-not-allowed border border-white/5' : 'btn-primary'}`}
                  >
                    {isPending && activeAction === 'withdraw' ? <Loader2 className="animate-spin" size={16} /> : "Withdraw"}
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
              <li>Tokens are mathematically locked in the 0xKeep V12 contract.</li>
              <li>Ownership cannot be claimed or drained by 0xKeep admins.</li>
              <li>Withdrawal is cryptographically impossible before the unlock date.</li>
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