'use client';

import { useState } from "react";
import { useReadContract, useReadContracts, useAccount } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { formatUnits, erc20Abi } from "viem";
import { Loader2, Pencil, Check, X, Archive } from "lucide-react";
import Link from "next/link";
import { formatLockId, formatVestingId } from "@/lib/formatter";
import { useLabels } from "@/hooks/useLabels";
import { formatDistanceToNow } from "date-fns";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useArchived } from "@/hooks/useArchived"; // New Import

const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const getContractAddress = (chainId?: number) => {
  return CONTRACT_ADDRESSES[chainId || 84532] || CONTRACT_ADDRESSES[84532];
};

const NetworkBadge = ({ chainId }: { chainId: number }) => {
  const name = chainId === 84532 ? "BASE SEPOLIA" : chainId === 8453 ? "BASE" : chainId === 42161 ? "ARBITRUM" : chainId === 10 ? "OPTIMISM" : "UNKNOWN";
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
      <span className="text-[#8B8B9E] font-mono text-[10px] uppercase tracking-widest hidden sm:inline">{name}</span>
    </div>
  );
};

const EditableLabel = ({ id, currentLabel, onSave }: { id: string, currentLabel: string, onSave: (val: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(currentLabel);

    const handleSave = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        onSave(val); setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                <input autoFocus type="text" className="bg-black/50 border border-white/20 rounded px-1 py-0.5 text-xs text-white w-24 focus:outline-none" value={val} onChange={(e) => setVal(e.target.value)} onClick={(e) => e.stopPropagation()} />
                <button onClick={handleSave} className="text-green-400"><Check size={12}/></button>
                <button onClick={() => setIsEditing(false)} className="text-red-400"><X size={12}/></button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group/label">
            <span className={currentLabel ? "text-white font-mono text-xs" : "text-zinc-400 text-xs"}>{currentLabel || id}</span>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }} className={`text-zinc-600 hover:text-white transition-colors ${currentLabel ? 'opacity-0 group-hover/label:opacity-100' : 'opacity-100'}`}><Pencil size={10} /></button>
        </div>
    );
};

export function LockRow({ lockId, chainId, index }: { lockId: bigint, chainId: number, index: number }) {
  const activeContract = getContractAddress(chainId);
  const { labels, setLabel } = useLabels();
  const { archived, toggleArchive } = useArchived();

  const { data: lock, isLoading } = useReadContract({
    address: activeContract, abi: CONTRACT_ABI, functionName: 'locks', args: [lockId], chainId: chainId
  });

  const tokenAddress = lock ? lock[0] : undefined;
  const { data: tokenData } = useReadContracts({
    contracts:[{ address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: chainId }], query: { enabled: !!tokenAddress }
  });
  const { data: price } = useTokenPrice(chainId, tokenAddress);

  if (isLoading || !lock) return <div className="grid grid-cols-7 p-5 border-b border-[#1C1C26] animate-pulse"><div className="col-span-7 h-4 bg-white/5 rounded"></div></div>;

  const rawAmount = lock[1];
  const decimals = Number(lock[3] || 18);
  const isWithdrawn = lock[4];
  const unlockTime = Number(lock[5]);

  const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
  const amountFormatted = Number(formatUnits(rawAmount, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const usdValue = price && price > 0 ? (Number(formatUnits(rawAmount, decimals)) * price).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : null;

  const unlockDate = new Date(unlockTime * 1000);
  const isUnlocked = Date.now() > unlockTime * 1000;
  
  let statusDisplay;
  if (isWithdrawn) {
      statusDisplay = <span className="text-[#555566] text-[10px] uppercase tracking-widest line-through">WITHDRAWN</span>;
  } else if (isUnlocked) {
      statusDisplay = <span className="text-green-400 text-[10px] uppercase tracking-widest">UNLOCKED</span>;
  } else {
      const timeString = formatDistanceToNow(unlockDate, { addSuffix: true });
      statusDisplay = (
        <div className="flex flex-col items-start">
            <span className="text-[#9D72FF] text-[10px] uppercase tracking-widest">LOCKED</span>
            <span className="text-zinc-500 text-[9px] lowercase">{timeString}</span>
        </div>
      );
  }

  const fancyId = formatLockId(lockId, chainId);
  const userLabel = labels[fancyId] || "";
  const isArchived = archived.includes(fancyId);

  return (
    <Link href={`/lock/${fancyId}`} target="_blank" className="grid grid-cols-7 min-w-[900px] p-5 border-b border-[#1C1C26] text-sm font-mono hover:bg-white/[0.02] transition-colors cursor-pointer group items-center">
      <div className="text-zinc-500 text-xs">{index}.</div>
      <div className="flex flex-col">
          <EditableLabel id={fancyId} currentLabel={userLabel} onSave={(name) => setLabel(fancyId, name)} />
          {userLabel && <span className="text-[9px] text-zinc-600 mt-1">{fancyId}</span>}
      </div>
      <div><NetworkBadge chainId={chainId} /></div>
      <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white">💰</div>
          <span className="text-zinc-300">{tokenSymbol}</span>
      </div>
      <div className="flex flex-col">
          <span className="text-white text-xs">{amountFormatted}</span>
          <span className="text-[9px] text-green-500/70 mt-1">{usdValue ? `≈ ${usdValue}` : "--"}</span>
      </div>
      <div>{statusDisplay}</div>
      
      <div className="flex items-center">
          {isWithdrawn ? (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArchive(fancyId); }} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] uppercase tracking-widest">
                  <Archive size={12} /> {isArchived ? "Unarchive" : "Archive"}
              </button>
          ) : (
              <span className="text-zinc-600">--</span>
          )}
      </div>
    </Link>
  );
}

export function VestingRow({ vestingId, chainId, index }: { vestingId: bigint, chainId: number, index: number }) {
    const activeContract = CONTRACT_ADDRESSES[chainId];
    const { labels, setLabel } = useLabels();
    const { archived, toggleArchive } = useArchived();

    const { data: vest, isLoading } = useReadContract({
      address: activeContract, abi: CONTRACT_ABI, functionName: 'vestings', args: [vestingId], chainId: chainId
    });
  
    const tokenAddress = vest ? vest[0] : undefined;
    const { data: tokenData } = useReadContracts({
      contracts:[{ address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: chainId }], query: { enabled: !!tokenAddress }
    });
    const { data: price } = useTokenPrice(chainId, tokenAddress);
  
    if (isLoading || !vest) return <div className="grid grid-cols-7 p-5 border-b border-[#1C1C26] animate-pulse"><div className="col-span-7 h-4 bg-white/5 rounded"></div></div>;
  
    const decimals = Number(vest[3] || 18);
    const totalRaw = vest[1];
    const claimedRaw = vest[4];

    const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
    const totalAmount = Number(formatUnits(totalRaw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const isFullyClaimed = claimedRaw >= totalRaw;
    const usdValue = price && price > 0 ? (Number(formatUnits(totalRaw, decimals)) * price).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : null;

    const startTime = Number(vest[5]);
    const cliff = Number(vest[6]);
    const duration = Number(vest[7]);
    const endTime = new Date((startTime + cliff + duration) * 1000);

    const fancyId = formatVestingId(vestingId, chainId);
    const userLabel = labels[fancyId] || "";
    const isArchived = archived.includes(fancyId);

    let statusDisplay;
    if (isFullyClaimed) {
        statusDisplay = <span className="text-[#555566] text-[10px] uppercase tracking-widest line-through">COMPLETED</span>;
    } else {
        const timeString = formatDistanceToNow(endTime, { addSuffix: true });
        statusDisplay = (
            <div className="flex flex-col items-start">
                <span className="text-blue-400 text-[10px] uppercase tracking-widest">ACTIVE</span>
                <span className="text-zinc-500 text-[9px] lowercase">ends {timeString}</span>
            </div>
        );
    }

    return (
      <Link href={`/vesting/${fancyId}`} target="_blank" className="grid grid-cols-7 min-w-[900px] p-5 border-b border-[#1C1C26] text-sm font-mono hover:bg-white/[0.02] transition-colors cursor-pointer group items-center">
        <div className="text-zinc-500 text-xs">{index}.</div>
        <div className="flex flex-col">
            <EditableLabel id={fancyId} currentLabel={userLabel} onSave={(name) => setLabel(fancyId, name)} />
            {userLabel && <span className="text-[9px] text-zinc-600 mt-1">{fancyId}</span>}
        </div>
        <div><NetworkBadge chainId={chainId} /></div>
        <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white">💎</div>
            <span className="text-zinc-300">{tokenSymbol}</span>
        </div>
        <div className="flex flex-col">
            <span className="text-white text-xs">{totalAmount}</span>
            <span className="text-[9px] text-green-500/70 mt-1">{usdValue ? `≈ ${usdValue}` : "--"}</span>
        </div>
        <div>{statusDisplay}</div>
        
        <div className="flex items-center">
            {isFullyClaimed ? (
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArchive(fancyId); }} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] uppercase tracking-widest">
                    <Archive size={12} /> {isArchived ? "Unarchive" : "Archive"}
                </button>
            ) : (
                <span className="text-zinc-600">--</span>
            )}
        </div>
      </Link>
    );
}