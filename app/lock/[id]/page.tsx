'use client';

import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { parseId } from "@/lib/formatter";
import { erc20Abi, formatUnits } from "viem";
import { Loader2, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Copy, Twitter, Code, ExternalLink } from "lucide-react";
import { useState } from "react";

// Helper to map Chain ID to Name for display
const getNetworkName = (chainId: number) => {
    const names: Record<number, string> = {
        84532: "Base Sepolia",
        8453: "Base",
        42161: "Arbitrum",
        10: "Optimism"
    };
    return names[chainId] || "Unknown Network";
};

export default function LockCertificatePage() {
  const { id } = useParams(); // e.g., "0xK-BS-101"
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // 1. PARSE ID & CHAIN
  let rawId = BigInt(0);
  let targetChainId = 84532; // Default to Base Sepolia
  
  try {
    const parsed = parseId(id as string);
    rawId = parsed.rawId;
    targetChainId = parsed.chainId;
  } catch (e) {
    console.error("Invalid ID format", e);
  }

  // 2. GET CONTRACT FOR TARGET CHAIN
  const activeContract = CONTRACT_ADDRESSES[targetChainId];

  const [extendDate, setExtendDate] = useState("");
  const [transferAddress, setTransferAddress] = useState("");
  const [activeAction, setActiveAction] = useState<'none' | 'extend' | 'transfer'>('none');
  
  // FEEDBACK STATES
  const [isCopied, setIsCopied] = useState(false);
  const [isEmbedCopied, setIsEmbedCopied] = useState(false); // NEW STATE

  // 3. FETCH DATA (Force read from targetChainId)
  const { data: lock, isLoading, refetch } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'locks',
    args: [rawId],
    chainId: targetChainId, 
  });

  const { data: tokenData } = useReadContracts({
    contracts: [
      { address: lock?.[1], abi: erc20Abi, functionName: 'symbol', chainId: targetChainId },
      { address: lock?.[1], abi: erc20Abi, functionName: 'decimals', chainId: targetChainId },
    ],
    query: { enabled: !!lock }
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) refetch();

  if (isLoading || !lock) return <div className="min-h-screen bg-[#030305] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  // --- DATA MAPPING ---
  const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
  const decimals = Number(tokenData?.[1]?.result || lock[2] || 18);
  const amount = Number(formatUnits(lock[4], decimals)).toLocaleString();
  const unlockDate = new Date(Number(lock[5]) * 1000);
  const isOwner = address === lock[3];
  const isUnlocked = Date.now() > unlockDate.getTime();
  const isWithdrawn = lock[6];

  // Validation
  const selectedExtend = extendDate ? new Date(extendDate) : null;
  const isExtensionInvalid = selectedExtend ? (selectedExtend.getTime() <= unlockDate.getTime() || selectedExtend.getTime() <= Date.now()) : false;

  // --- SMART HANDLERS (Check Network First) ---
  const executeAction = (action: () => void) => {
    if (chain?.id !== targetChainId) {
        if (confirm(`This lock is on ${getNetworkName(targetChainId)}. Switch network to interact?`)) {
            switchChain({ chainId: targetChainId });
        }
        return;
    }
    action();
  };

  const handleWithdraw = () => executeAction(() => {
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'withdrawLock', args: [rawId] });
  });

  const handleExtend = () => executeAction(() => {
    if (!extendDate || isExtensionInvalid) return;
    const newTimestamp = Math.floor(new Date(extendDate).getTime() / 1000);
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'extendLock', args: [rawId, BigInt(newTimestamp)] });
  });

  const handleTransfer = () => executeAction(() => {
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'transferLockOwnership', args: [rawId, transferAddress as `0x${string}`] });
  });

  // Share Handlers
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = `I just secured liquidity on @0xKeepProtocol.\n\n🔒 Lock ID: #${id}\n💎 Amount: ${amount} ${tokenSymbol}\n\nVerify proof here:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const handleEmbed = () => {
    // UPDATED: No fixed width. 100% width, max-width 400px. Responsive height.
    const embedCode = `<iframe 
  src="${window.location.origin}/embed/lock/${id}" 
  width="100%" 
  height="220" 
  style="max-width: 400px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;" 
  frameborder="0"
></iframe>`;
    
    navigator.clipboard.writeText(embedCode);
    setIsEmbedCopied(true);
    setTimeout(() => setIsEmbedCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#030305]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-purple-500/10 p-2 rounded-lg">
                    <ShieldCheck className="text-purple-400" size={24} />
                </div>
                <h1 className="text-xl md:text-2xl font-mono uppercase text-white">Liquidity Certificate #{id}</h1>
            </div>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Immutable Proof of Locked Assets</p>
        </div>

        {/* MAIN CERTIFICATE CARD */}
        <div className="glass-card rounded-2xl p-6 md:p-8 mb-4 relative overflow-hidden">
            {isWithdrawn && <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 font-mono uppercase text-xl tracking-widest text-zinc-500">Asset Withdrawn</div>}
            
            {/* NETWORK PILL */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6">
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,1)]"></div>
                    <span className="text-blue-400 font-mono text-[9px] md:text-[10px] uppercase tracking-wider">
                        {getNetworkName(targetChainId)}
                    </span>
                </div>
            </div>

            {/* DATA GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 md:mt-4">
                <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">Locked Amount</p>
                    <p className="text-3xl md:text-4xl font-mono text-white break-all">{amount}</p>
                    <p className="text-purple-400 font-mono text-sm mt-1">{tokenSymbol}</p>
                </div>
                <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">Unlock Date</p>
                    <p className="text-2xl font-mono text-white">{unlockDate.toLocaleDateString()}</p>
                    <p className="text-zinc-400 font-mono text-sm mt-1">{unlockDate.toLocaleTimeString()}</p>
                    
                    <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wide border ${isUnlocked ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {isUnlocked ? "Unlocked" : `Locked for ${Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} Days`}
                    </div>
                </div>
            </div>

            {/* METADATA */}
            <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-xs font-mono">
                <div>
                    <p className="text-zinc-500 uppercase tracking-widest mb-1">Owner</p>
                    <a href={`https://sepolia.basescan.org/address/${lock[3]}`} target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-white transition-colors break-all flex items-center gap-2 group">
                        {lock[3]}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>
                <div>
                    <p className="text-zinc-500 uppercase tracking-widest mb-1">Token Address</p>
                    <a href={`https://sepolia.basescan.org/token/${lock[1]}`} target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-white transition-colors break-all flex items-center gap-2 group">
                        {lock[1]}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>
            </div>

            {/* MARKETING BUTTONS */}
            <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap gap-4 md:gap-6 items-center">
                <button onClick={handleCopyLink} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
                    {isCopied ? <CheckCircle2 size={14} className="text-green-400"/> : <Copy size={14} className="group-hover:text-purple-400"/>}
                    <span className="font-mono text-[10px] uppercase tracking-widest">{isCopied ? "Copied" : "Copy Link"}</span>
                </button>
                <button onClick={handleShareTwitter} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
                    <Twitter size={14} className="group-hover:text-blue-400"/>
                    <span className="font-mono text-[10px] uppercase tracking-widest">Share on X</span>
                </button>
                
                {/* UPDATED EMBED BUTTON */}
                <button onClick={handleEmbed} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
                    {isEmbedCopied ? <CheckCircle2 size={14} className="text-green-400"/> : <Code size={14} className="group-hover:text-orange-400"/>}
                    <span className="font-mono text-[10px] uppercase tracking-widest">{isEmbedCopied ? "Copied Code" : "Embed"}</span>
                </button>
            </div>
        </div>

        {/* VERIFIED BADGE */}
        <div className="flex justify-center mb-10">
            <a href={`https://sepolia.basescan.org/address/${activeContract}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer group">
                <CheckCircle2 size={14} className="text-purple-500 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 group-hover:text-white">Verified by 0xKeep Protocol</span>
                <ExternalLink size={10} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
        </div>

        {/* OWNER CONTROLS */}
        {isOwner && !isWithdrawn && (
            <div className="space-y-4">
                <h3 className="font-mono uppercase text-sm text-zinc-500 tracking-widest mb-4">Owner Controls</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={handleWithdraw} disabled={!isUnlocked || isPending} className="btn-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isPending ? <Loader2 className="animate-spin" /> : "Withdraw Assets"}
                    </button>
                    <button onClick={() => setActiveAction(activeAction === 'extend' ? 'none' : 'extend')} className="btn-ghost flex items-center justify-center gap-2">
                        <span>Extend Lock</span>
                        {activeAction === 'extend' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => setActiveAction(activeAction === 'transfer' ? 'none' : 'transfer')} className="btn-ghost flex items-center justify-center gap-2">
                        <span>Transfer Ownership</span>
                        {activeAction === 'transfer' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>

                {/* EXTEND FORM */}
                {activeAction === 'extend' && (
                    <div className="glass-panel p-6 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs font-mono uppercase tracking-wide text-zinc-300 mb-4">Extend lock duration.</p>
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-col md:flex-row gap-4">
                                <input 
                                    type="datetime-local" 
                                    className={`bg-black/50 border rounded-lg p-3 text-white font-mono flex-1 text-sm ${isExtensionInvalid ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}`}
                                    onChange={(e) => setExtendDate(e.target.value)} 
                                />
                                <button 
                                    onClick={handleExtend} 
                                    disabled={isPending || !extendDate || isExtensionInvalid} 
                                    className="btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPending ? <Loader2 className="animate-spin"/> : "Confirm"}
                                </button>
                            </div>
                            {isExtensionInvalid && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest">Error: Must be later than current unlock date</p>}
                        </div>
                    </div>
                )}

                {/* TRANSFER FORM */}
                {activeAction === 'transfer' && (
                    <div className="glass-panel p-6 rounded-xl animate-in fade-in slide-in-from-top-2 border-l-4 border-l-red-500">
                        <div className="flex items-center gap-2 text-red-400 mb-2"><AlertTriangle size={16} /><p className="font-mono uppercase text-xs font-bold">Warning: Irreversible Action</p></div>
                        <p className="text-xs font-mono uppercase tracking-wide text-zinc-300 mb-4">Permanently transfer control to a new wallet.</p>
                        <div className="flex flex-col md:flex-row gap-4">
                            <input type="text" placeholder="0x..." className="bg-black/50 border border-white/10 rounded-lg p-3 text-white font-mono flex-1 text-sm" onChange={(e) => setTransferAddress(e.target.value)} />
                            <button onClick={handleTransfer} disabled={isPending} className="btn-ghost bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20">{isPending ? <Loader2 className="animate-spin"/> : "Transfer"}</button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* TRUST AMPLIFIER */}
        <div className="mb-10 p-6 border border-white/5 rounded-xl bg-white/[0.02]">
            <h3 className="font-mono uppercase text-xs text-zinc-500 tracking-widest mb-4">Protocol Guarantees</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-green-400" />
                        <span className="text-sm font-medium text-white font-mono">What this proves</span>
                    </div>
                    <ul className="font-mono text-xs text-zinc-400 space-y-2 ml-6 list-disc marker:text-green-900">
                        <li>Tokens are mathematically locked in the 0xKeep contract.</li>
                        <li>Ownership cannot be claimed or drained by 0xKeep admins.</li>
                        <li>Withdrawal is cryptographically impossible before the unlock date.</li>
                    </ul>
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-orange-400" />
                        <span className="text-sm font-medium text-white font-mono">What this does NOT prove</span>
                    </div>
                    <ul className="font-mono text-xs text-zinc-400 space-y-2 ml-6 list-disc marker:text-orange-900">
                        <li>This does not prove the token itself is safe from rug pulls.</li>
                        <li>This does not guarantee the project's success or value.</li>
                        <li>0xKeep is an infrastructure provider and does not endorse specific assets.</li>
                    </ul>
                </div>
            </div>
        </div>
        
      </div>
    </main>
  );
}