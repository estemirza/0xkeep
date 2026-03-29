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
        421614: "ARB Sepolia",
        10: "Optimism",
        11155420: "OP Sepolia"
    };
    return names[chainId] || "Unknown Network";
};

export default function LockEmbed() {
  const { id } = useParams(); 
  
  if (!id) return <div className="flex h-full items-center justify-center bg-[#030305]"><Loader2 className="animate-spin text-zinc-600" /></div>;
  
  let rawId = BigInt(0);
  let targetChainId = 84532;
  
  try {
    const decodedId = decodeURIComponent(id as string);
    const parsed = parseId(decodedId);
    rawId = parsed.rawId;
    targetChainId = parsed.chainId;
  } catch (e) { 
    return (
        <div className="flex h-full flex-col items-center justify-center bg-[#030305] text-white font-mono text-xs border border-white/10 rounded-2xl p-6">
            <span className="text-red-400 mb-2">⚠ INVALID CERTIFICATE ID</span>
            <span className="text-zinc-500">The provided ID format is incorrect.</span>
        </div>
    );
  }

  const activeContract = CONTRACT_ADDRESSES[targetChainId];

  const { data: lock, isLoading } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'locks',
    args: [rawId],
    chainId: targetChainId,
  });

  const { data: tokenData } = useReadContracts({
    contracts:[
      { address: lock?.[0], abi: erc20Abi, functionName: 'symbol', chainId: targetChainId },
    ],
    query: { enabled: !!lock?.[0] }
  });

  if (isLoading || !lock) return <div className="flex h-full items-center justify-center bg-[#030305]"><Loader2 className="animate-spin text-zinc-600" /></div>;

  const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
  const decimals = Number(lock[3] || 18);
  const amount = Number(formatUnits(lock[1], decimals)).toLocaleString();
  const unlockDate = new Date(Number(lock[5]) * 1000);
  const isUnlocked = Date.now() > unlockDate.getTime();

  return (
    <a 
      href={`${window.location.origin}/lock/${id}`} 
      target="_blank" 
      className="flex flex-col w-full h-full bg-[#030305] border border-white/10 text-white font-sans decoration-0 cursor-pointer group relative overflow-hidden transition-all duration-500 ease-out hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(124,58,237,0.15)] hover:-translate-y-1"
    >
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.15),_transparent_60%)] pointer-events-none transition-opacity duration-500 opacity-60 group-hover:opacity-100" />

      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2">
            <Logo className="w-5 h-5 transition-transform duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            <span className="font-chakra font-bold text-base tracking-wide transition-colors duration-300 group-hover:text-purple-100">0xKeep</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 group-hover:border-white/10 transition-colors">
            <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,1)]"></div>
            <span className="text-blue-400 font-mono text-[9px] uppercase tracking-wider">
                {getNetworkName(targetChainId)}
            </span>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 relative z-10 flex flex-col justify-center">
        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block mb-1 transition-colors group-hover:text-zinc-400">Total Locked</span>
        
        <div className="font-mono text-xl font-medium text-white mb-3 flex items-baseline gap-2 truncate transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]">
            {amount} <span className="text-purple-400 text-xs transition-colors group-hover:text-purple-300">{tokenSymbol}</span>
        </div>

        <div className={`inline-flex self-start items-center gap-2 px-2.5 py-1 rounded-md font-mono text-[9px] uppercase tracking-wide border transition-all duration-300 ${isUnlocked ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400 group-hover:bg-red-500/20 group-hover:border-red-500/30'}`}>
             {isUnlocked ? "Unlocked" : `🔒 Locked: ${unlockDate.toLocaleDateString()}`}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between relative z-10 group-hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <CheckCircle2 size={10} className="text-purple-500" />
            <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-400 group-hover:text-zinc-300">Verified Protocol</span>
        </div>
        <ExternalLink size={10} className="text-zinc-600 group-hover:text-white transition-colors" />
      </div>
    </a>
  );
}