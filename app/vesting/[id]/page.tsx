'use client';

import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { parseId } from "@/lib/formatter";
import { erc20Abi, formatUnits } from "viem";
import { Loader2, TrendingUp, CheckCircle2, Copy, Twitter, Code, ExternalLink, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

// Helper for Network Name
const getNetworkName = (chainId: number) => {
    const names: Record<number, string> = {
        84532: "Base Sepolia",
        8453: "Base",
        42161: "Arbitrum",
        10: "Optimism"
    };
    return names[chainId] || "Unknown Network";
};

export default function VestingCertificatePage() {
  const { id } = useParams();
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const [isCopied, setIsCopied] = useState(false);
  const [isEmbedCopied, setIsEmbedCopied] = useState(false);
  
  // ACTION STATES
  const [transferAddress, setTransferAddress] = useState("");
  const [activeAction, setActiveAction] = useState<'none' | 'transfer'>('none');

  // 1. PARSE ID & CHAIN
  let rawId = BigInt(0);
  let targetChainId = 84532;
  try {
    const parsed = parseId(id as string);
    rawId = parsed.rawId;
    targetChainId = parsed.chainId;
  } catch (e) { console.error(e); }

  const activeContract = CONTRACT_ADDRESSES[targetChainId];

  // 2. FETCH DATA
  const { data: vest, isLoading, refetch } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'vestings',
    args: [rawId],
    chainId: targetChainId,
  });

  const { data: tokenData } = useReadContracts({
    contracts: [
      { address: vest?.[1], abi: erc20Abi, functionName: 'symbol', chainId: targetChainId },
      { address: vest?.[1], abi: erc20Abi, functionName: 'decimals', chainId: targetChainId },
    ],
    query: { enabled: !!vest }
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  
  if (isSuccess) refetch();

  if (isLoading || !vest) return <div className="min-h-screen bg-[#030305] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  // --- V6/V8 DATA MAPPING ---
  const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
  const decimals = Number(tokenData?.[1]?.result || vest[2] || 18);
  const totalAmount = Number(formatUnits(vest[4], decimals));
  const claimedAmount = Number(formatUnits(vest[5], decimals));
  const startTime = Number(vest[6]);
  const cliffDuration = Number(vest[7]);
  const duration = Number(vest[8]);
  
  const absoluteEndTime = startTime + cliffDuration + duration;
  const now = Math.floor(Date.now() / 1000);
  
  // Calc Claimable
  let claimableNow = 0;
  if (now > startTime + cliffDuration) {
      const timePassedSinceCliff = now - (startTime + cliffDuration);
      let totalUnlocked = 0;
      if (timePassedSinceCliff >= duration) {
          totalUnlocked = totalAmount;
      } else {
          totalUnlocked = (totalAmount * timePassedSinceCliff) / duration;
      }
      claimableNow = Math.max(0, totalUnlocked - claimedAmount);
  }

  const percentClaimed = (claimedAmount / totalAmount) * 100;
  const totalDuration = cliffDuration + duration;
  const timeElapsedTotal = Math.max(0, now - startTime);
  const percentTime = Math.min(100, (timeElapsedTotal / totalDuration) * 100);

  const isOwner = address === vest[3];
  const isCompleted = claimedAmount >= totalAmount;

  // SMART HANDLER WRAPPER
  const executeAction = (action: () => void) => {
    if (chain?.id !== targetChainId) {
        if (confirm(`Switch network to ${getNetworkName(targetChainId)}?`)) {
            switchChain({ chainId: targetChainId });
        }
        return;
    }
    action();
  };

  const handleClaim = () => executeAction(() => {
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'claimVesting', args: [rawId] });
  });

  const handleTransfer = () => executeAction(() => {
    writeContract({ address: activeContract, abi: CONTRACT_ABI, functionName: 'transferVestingOwnership', args: [rawId, transferAddress as `0x${string}`] });
  });

  // Share Handlers
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = `I just started a vesting schedule on @0xKeepProtocol.\n\n📈 Vesting ID: #${id}\n💎 Total: ${totalAmount.toLocaleString()} ${tokenSymbol}\n\nVerify proof here:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const handleEmbed = () => {
    const embedCode = `<iframe 
  src="${window.location.origin}/embed/vesting/${id}" 
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
                <div className="bg-blue-500/10 p-2 rounded-lg">
                    <TrendingUp className="text-blue-400" size={24} />
                </div>
                <h1 className="text-xl md:text-2xl font-mono uppercase text-white">Vesting Schedule #{id}</h1>
            </div>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Linear Token Release Protocol</p>
        </div>

        {/* MAIN CARD (Same as before...) */}
        <div className="glass-card rounded-2xl p-6 md:p-8 mb-4 relative">
            <div className="absolute top-4 right-4 md:top-6 md:right-6">
                <div className="flex items-center gap-2 bg-black/40 px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,1)]"></div>
                    <span className="text-blue-400 font-mono text-[9px] md:text-[10px] uppercase tracking-wider">{getNetworkName(targetChainId)}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start mb-8 mt-8 md:mt-4 gap-6 md:gap-0">
                <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">Total Allocation</p>
                    <p className="text-3xl md:text-4xl font-mono text-white break-all">{totalAmount.toLocaleString()}</p>
                    <p className="text-purple-400 font-mono text-sm mt-1">{tokenSymbol}</p>
                </div>
                <div className="text-left md:text-right">
                    <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">Claimed So Far</p>
                    <p className="text-2xl font-mono text-zinc-300 break-all">{claimedAmount.toLocaleString()}</p>
                    <p className="text-zinc-500 font-mono text-xs mt-1">{percentClaimed.toFixed(1)}%</p>
                </div>
            </div>

            <div className="relative h-4 bg-white/5 rounded-full overflow-hidden mb-2">
                <div className="absolute top-0 left-0 h-full bg-purple-500/20" style={{ width: `${percentTime}%` }} />
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${percentClaimed}%` }} />
            </div>
            <div className="flex justify-between text-xs font-mono text-zinc-500 uppercase tracking-widest mb-8">
                <span>Start: {new Date(startTime * 1000).toLocaleDateString()}</span>
                {cliffDuration > 0 && <span className="text-yellow-500">Cliff: {new Date((startTime + cliffDuration) * 1000).toLocaleDateString()}</span>}
                <span>End: {new Date(absoluteEndTime * 1000).toLocaleDateString()}</span>
            </div>

            <div className="bg-black/30 rounded-xl p-6 border border-white/5 flex flex-col md:flex-row items-center justify-between mb-8 gap-4 md:gap-0">
                <div className="text-center md:text-left">
                    <p className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-1">Available to Claim</p>
                    <p className="text-2xl font-mono text-white">{claimableNow.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                    <p className="text-zinc-500 font-mono text-xs mt-1">{tokenSymbol}</p>
                </div>
                
                {isOwner && !isCompleted && (
                    <button onClick={handleClaim} disabled={claimableNow <= 0 || isPending} className="w-full md:w-auto btn-glow disabled:opacity-50 disabled:cursor-not-allowed">
                        {isPending ? <Loader2 className="animate-spin" /> : "Claim Tokens"}
                    </button>
                )}
                {isCompleted && <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono uppercase rounded-lg">Vesting Complete</div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-xs font-mono border-t border-white/5 pt-8">
                <div>
                    <p className="text-zinc-500 uppercase tracking-widest mb-1">Beneficiary</p>
                    <a href={`https://sepolia.basescan.org/address/${vest[3]}`} target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-white transition-colors break-all flex items-center gap-2 group">
                        {vest[3]}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>
                <div>
                    <p className="text-zinc-500 uppercase tracking-widest mb-1">Token Contract</p>
                    <a href={`https://sepolia.basescan.org/token/${vest[1]}`} target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-white transition-colors break-all flex items-center gap-2 group">
                        {vest[1]}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap gap-4 md:gap-6 items-center">
                <button onClick={handleCopyLink} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
                    {isCopied ? <CheckCircle2 size={14} className="text-green-400"/> : <Copy size={14} className="group-hover:text-purple-400"/>}
                    <span className="font-mono text-[10px] uppercase tracking-widest">{isCopied ? "Copied" : "Copy Link"}</span>
                </button>
                <button onClick={handleShareTwitter} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
                    <Twitter size={14} className="group-hover:text-blue-400"/>
                    <span className="font-mono text-[10px] uppercase tracking-widest">Share on X</span>
                </button>
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

        {/* OWNER CONTROLS (NEW V8 FEATURE) */}
        {isOwner && !isCompleted && (
            <div className="space-y-4">
                <h3 className="font-mono uppercase text-sm text-zinc-500 tracking-widest mb-4">Owner Controls</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Transfer Button */}
                    <button 
                        onClick={() => setActiveAction(activeAction === 'transfer' ? 'none' : 'transfer')}
                        className="btn-ghost flex items-center justify-center gap-2"
                    >
                        <span>Transfer Ownership</span>
                        {activeAction === 'transfer' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>

                {/* TRANSFER FORM */}
                {activeAction === 'transfer' && (
                    <div className="glass-panel p-6 rounded-xl animate-in fade-in slide-in-from-top-2 border-l-4 border-l-red-500">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                            <AlertTriangle size={16} />
                            <p className="font-mono uppercase text-xs font-bold">Warning: Irreversible Action</p>
                        </div>
                        <p className="text-xs font-mono uppercase tracking-wide text-zinc-300 mb-4">
                            Permanently transfer control of the remaining vesting schedule to a new wallet.
                        </p>
                        <div className="flex flex-col md:flex-row gap-4">
                            <input 
                                type="text" 
                                placeholder="0x..." 
                                className="bg-black/50 border border-white/10 rounded-lg p-3 text-white font-mono flex-1 text-sm" 
                                onChange={(e) => setTransferAddress(e.target.value)} 
                            />
                            <button 
                                onClick={handleTransfer} 
                                disabled={isPending} 
                                className="btn-ghost bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
                            >
                                {isPending ? <Loader2 className="animate-spin"/> : "Transfer"}
                            </button>
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
                        <li>Tokens are vesting according to an immutable schedule.</li>
                        <li>Claiming is mathematically enforced by the contract.</li>
                        <li>No admin can stop or alter the distribution.</li>
                    </ul>
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-orange-400" />
                        <span className="text-sm font-medium text-white font-mono">What this does NOT prove</span>
                    </div>
                    <ul className="font-mono text-xs text-zinc-400 space-y-2 ml-6 list-disc marker:text-orange-900">
                        <li>This does not guarantee the token has value.</li>
                        <li>This does not prevent the team from selling other unlocked wallets.</li>
                        <li>0xKeep does not endorse this project.</li>
                    </ul>
                </div>
            </div>
        </div>

      </div>
    </main>
  );
}