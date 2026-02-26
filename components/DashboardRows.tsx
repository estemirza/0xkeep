'use client';

import { useState } from "react";
import { useReadContract, useReadContracts, useAccount } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { formatUnits, erc20Abi } from "viem";
import { Loader2, ArrowRight, Pencil, Check, X } from "lucide-react";
import Link from "next/link";
import { formatLockId, formatVestingId } from "@/lib/formatter";
import { useLabels } from "@/hooks/useLabels";
import { formatDistanceToNow } from "date-fns";
import { useTokenPrice } from "@/hooks/useTokenPrice";

const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const getContractAddress = (chainId?: number) => {
  return CONTRACT_ADDRESSES[chainId || 84532] || CONTRACT_ADDRESSES[84532];
};

const NetworkBadge = ({ chainId }: { chainId?: number }) => {
  const name = chainId === 84532 ? "Base Sepolia" : "Unknown"; // You can map other IDs here
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
      <span className="text-blue-400 font-mono text-xs uppercase tracking-wide hidden sm:inline">{name}</span>
    </div>
  );
};

// --- EDITABLE LABEL COMPONENT ---
const EditableLabel = ({ id, currentLabel, onSave }: { id: string, currentLabel: string, onSave: (val: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(currentLabel);

    const handleSave = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onSave(val);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                <input 
                    autoFocus
                    type="text" 
                    className="bg-black/50 border border-white/20 rounded px-1 py-0.5 text-xs text-white font-sans w-24 focus:outline-none focus:border-purple-500"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
                <button onClick={handleSave} className="text-green-400 hover:text-green-300"><Check size={12}/></button>
                <button onClick={() => setIsEditing(false)} className="text-red-400 hover:text-red-300"><X size={12}/></button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 group/label">
            <span className={currentLabel ? "text-white font-medium font-sans" : "text-zinc-400"}>
                {currentLabel || id}
            </span>
            <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }}
                className={`text-zinc-600 hover:text-zinc-300 transition-colors ${currentLabel ? 'opacity-0 group-hover/label:opacity-100' : 'opacity-100'}`}
            >
                <Pencil size={10} />
            </button>
        </div>
    );
};

// --- LOCK ROW ---
export function LockRow({ lockId }: { lockId: bigint }) {
  const { chain } = useAccount();
  const activeContract = getContractAddress(chain?.id);
  const { labels, setLabel } = useLabels();

  const { data: lock, isLoading } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'locks',
    args: [lockId],
  });

  // V11 MAPPING: token(0), amount(1), owner(2), decimals(3), withdrawn(4), unlockTime(5)
  const tokenAddress = lock ? lock[0] : undefined;
  
  const { data: tokenData } = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: erc20Abi, functionName: 'symbol' },
    ],
    query: { enabled: !!tokenAddress }
  });

  const { data: price } = useTokenPrice(chain?.id, tokenAddress);

  if (isLoading || !lock) {
    return <div className="grid grid-cols-6 p-4 border-b border-white/5 animate-pulse"><div className="col-span-6 h-4 bg-white/5 rounded"></div></div>;
  }

  const rawAmount = lock[1];
  const ownerAddress = lock[2];
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
      statusDisplay = <span className="text-zinc-500 line-through text-[10px] sm:text-xs">WITHDRAWN</span>;
  } else if (isUnlocked) {
      statusDisplay = <span className="text-green-400 text-[10px] sm:text-xs">UNLOCKED</span>;
  } else {
      const timeString = formatDistanceToNow(unlockDate, { addSuffix: true });
      statusDisplay = (
        <div className="flex flex-col items-start">
            <span className="text-purple-400 text-[10px] sm:text-xs">LOCKED</span>
            <span className="text-zinc-500 text-[9px] lowercase">{timeString}</span>
        </div>
      );
  }

  const currentChainId = chain?.id || 84532;
  const fancyId = formatLockId(lockId, currentChainId);
  const userLabel = labels[fancyId] || "";

  return (
    <Link 
      href={`/lock/${fancyId}`} 
      target="_blank"
      className="grid grid-cols-6 min-w-[900px] p-4 border-b border-white/5 text-sm font-mono hover:bg-white/5 transition-colors cursor-pointer group items-center"
    >
      <div className="flex flex-col">
          <EditableLabel id={fancyId} currentLabel={userLabel} onSave={(name) => setLabel(fancyId, name)} />
          {userLabel && <span className="text-[9px] text-zinc-500">{fancyId}</span>}
      </div>

      <div><NetworkBadge chainId={chain?.id} /></div>
      <div className="text-zinc-300 group-hover:text-white">{shortAddress(ownerAddress)}</div>
      
      <div className="flex flex-col">
          <span className="text-white font-medium">{amountFormatted}</span>
          {usdValue && <span className="text-[10px] text-zinc-500">≈ {usdValue}</span>}
      </div>

      <div className="text-zinc-400">{tokenSymbol}</div>
      <div className="flex items-center justify-between">
        {statusDisplay}
        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500" />
      </div>
    </Link>
  );
}

// --- VESTING ROW ---
export function VestingRow({ vestingId }: { vestingId: bigint }) {
    const { chain } = useAccount();
    const activeContract = getContractAddress(chain?.id);
    const { labels, setLabel } = useLabels();

    const { data: vest, isLoading } = useReadContract({
      address: activeContract,
      abi: CONTRACT_ABI,
      functionName: 'vestings',
      args: [vestingId],
    });

    // V11 MAPPING: token(0), total(1), owner(2), decimals(3), claimed(4), start(5), cliff(6), duration(7)
    const tokenAddress = vest ? vest[0] : undefined;
  
    const { data: tokenData } = useReadContracts({
      contracts: [
        { address: tokenAddress, abi: erc20Abi, functionName: 'symbol' },
      ],
      query: { enabled: !!tokenAddress }
    });

    const { data: price } = useTokenPrice(chain?.id, tokenAddress);
  
    if (isLoading || !vest) return null;
  
    const totalRaw = vest[1];
    const ownerAddress = vest[2];
    const decimals = Number(vest[3] || 18);
    const claimedRaw = vest[4];
    const startTime = Number(vest[5]);
    const cliff = Number(vest[6]);
    const duration = Number(vest[7]);

    const tokenSymbol = tokenData?.[0]?.result?.toString() || "ERC20";
    const totalAmount = Number(formatUnits(totalRaw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const isFullyClaimed = claimedRaw >= totalRaw;
    const usdValue = price && price > 0 ? (Number(formatUnits(totalRaw, decimals)) * price).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : null;

    const endTime = new Date((startTime + cliff + duration) * 1000);
    const currentChainId = chain?.id || 84532;
    const fancyId = formatVestingId(vestingId, currentChainId);
    const userLabel = labels[fancyId] || "";

    let statusDisplay;
    if (isFullyClaimed) {
        statusDisplay = <span className="text-zinc-500 text-[10px] sm:text-xs">COMPLETED</span>;
    } else {
        const timeString = formatDistanceToNow(endTime, { addSuffix: true });
        statusDisplay = (
            <div className="flex flex-col items-start">
                <span className="text-blue-400 text-[10px] sm:text-xs">ACTIVE</span>
                <span className="text-zinc-500 text-[9px] lowercase">ends {timeString}</span>
            </div>
        );
    }

    return (
      <Link 
        href={`/vesting/${fancyId}`} 
        target="_blank"
        className="grid grid-cols-6 min-w-[900px] p-4 border-b border-white/5 text-sm font-mono hover:bg-white/5 transition-colors cursor-pointer group items-center"
      >
        <div className="flex flex-col">
            <EditableLabel id={fancyId} currentLabel={userLabel} onSave={(name) => setLabel(fancyId, name)} />
            {userLabel && <span className="text-[9px] text-zinc-500">{fancyId}</span>}
        </div>

        <div><NetworkBadge chainId={chain?.id} /></div>
        <div className="text-zinc-300">{shortAddress(ownerAddress)}</div>
        
        <div className="flex flex-col">
            <span className="text-white font-medium">{totalAmount}</span>
            {usdValue && <span className="text-[10px] text-zinc-500">≈ {usdValue}</span>}
        </div>

        <div className="text-zinc-400">{tokenSymbol}</div>
        <div className="flex items-center justify-between">
            {statusDisplay}
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500" />
        </div>
      </Link>
    );
}