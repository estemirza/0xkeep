'use client';

import { useParams } from "next/navigation";
import { useReadContract, useReadContracts } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { parseId } from "@/lib/formatter";
import { erc20Abi, formatUnits } from "viem";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import Logo from "@/components/Logo";

const getNetworkName = (chainId: number) => {
    const names: Record<number, string> = {
        84532: "Base Sepolia",
        8453: "Base",
        42161: "Arbitrum",
        10: "Optimism"
    };
    return names[chainId] || "Unknown Network";
};

export default function VestingEmbed() {
  const { id } = useParams();
  
  let rawId = BigInt(0);
  let targetChainId = 84532;
  try {
    const parsed = parseId(id as string);
    rawId = parsed.rawId;
    targetChainId = parsed.chainId;
  } catch (e) { console.error(e); }

  const activeContract = CONTRACT_ADDRESSES[targetChainId];

  const { data: vest, isLoading } = useReadContract({
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

  if (isLoading || !vest) return <div className="flex h-full items-center justify-center bg-[#030305]"><Loader2 className="animate-spin text-white" /></div>;

  const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
  const decimals = Number(tokenData?.[1]?.result || vest[2] || 18);
  const totalAmount = Number(formatUnits(vest[4], decimals));
  const claimedAmount = Number(formatUnits(vest[5], decimals));
  const startTime = Number(vest[6]);
  const cliffDuration = Number(vest[7]);
  const duration = Number(vest[8]);
  
  const now = Math.floor(Date.now() / 1000);
  const endTime = new Date((startTime + cliffDuration + duration) * 1000);
  
  // Progress Calc
  const totalDuration = cliffDuration + duration;
  const timeElapsedTotal = Math.max(0, now - startTime);
  const percentTime = Math.min(100, (timeElapsedTotal / totalDuration) * 100);
  const percentClaimed = (claimedAmount / totalAmount) * 100;

  return (
    <a 
      href={`${window.location.origin}/vesting/${id}`} 
      target="_blank" 
      // HOVER EFFECTS: Purple Shadow, Border Glow, Lift
      className="flex flex-col w-full h-full bg-[#030305] border border-white/10 text-white font-sans decoration-0 cursor-pointer group relative overflow-hidden transition-all duration-500 ease-out hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(124,58,237,0.15)] hover:-translate-y-1"
    >
      {/* Background Gradient - Brightens on Hover */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_60%)] pointer-events-none transition-opacity duration-500 opacity-60 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2">
            <Logo className="w-5 h-5 transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            <span className="font-chakra font-bold text-base tracking-wide transition-colors duration-300 group-hover:text-blue-100">0xKeep</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 group-hover:border-white/10 transition-colors">
            <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,1)]"></div>
            <span className="text-blue-400 font-mono text-[9px] uppercase tracking-wider">
                {getNetworkName(targetChainId)}
            </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 relative z-10 flex flex-col justify-center">
        
        {/* Progress Header */}
        <div className="flex justify-between items-end mb-2">
            <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block mb-0.5 transition-colors group-hover:text-zinc-400">Vesting</span>
                {/* TEXT SHINE on Percentage */}
                <span className="font-mono text-lg text-white font-medium transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                    {percentClaimed.toFixed(0)}% <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 font-normal">Claimed</span>
                </span>
            </div>
            <div className="text-right">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block mb-0.5">Total</span>
                <span className="font-mono text-xs text-zinc-300 group-hover:text-white transition-colors">{totalAmount.toLocaleString()} {tokenSymbol}</span>
            </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
             <div className="absolute top-0 left-0 h-full bg-purple-500/20" style={{ width: `${percentTime}%` }} />
             <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 group-hover:brightness-125" style={{ width: `${percentClaimed}%` }} />
        </div>

        <div className="flex justify-between font-mono text-[9px] text-zinc-500 uppercase">
            <span className="group-hover:text-zinc-400 transition-colors">Start: {new Date(startTime * 1000).getFullYear()}</span>
            <span className="group-hover:text-zinc-400 transition-colors">End: {endTime.getFullYear()}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between relative z-10 group-hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <CheckCircle2 size={10} className="text-purple-500" />
            <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300">Verified by 0xKeep Protocol</span>
        </div>
        <ExternalLink size={10} className="text-zinc-600 group-hover:text-white transition-colors" />
      </div>
    </a>
  );
}