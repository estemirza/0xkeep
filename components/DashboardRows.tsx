'use client';

import { useState } from "react";
import { useReadContract, useReadContracts, useAccount } from "wagmi";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { formatUnits, erc20Abi } from "viem";
import { Loader2, Pencil, Check, X, Archive } from "lucide-react";
import Link from "next/link";
import { formatLockId, formatVestingId, CHAIN_NAMES, CHAIN_COLORS } from "@/lib/formatter";
import { useLabels } from "@/hooks/useLabels";
import { formatDistanceToNow } from "date-fns";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useArchived } from "@/hooks/useArchived";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

// FIX D2: Single consistent address resolver — no silent testnet fallback
const getContractAddress = (chainId?: number): `0x${string}` | undefined => {
  if (!chainId) return undefined;
  return CONTRACT_ADDRESSES[chainId];
};

// FIX D6: Network badge uses correct color per chain from shared constant
const NetworkBadge = ({ chainId }: { chainId: number }) => {
  const name  = CHAIN_NAMES[chainId]  || "UNKNOWN";
  const color = CHAIN_COLORS[chainId] || "bg-gray-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`}></div>
      <span className="text-[#8B8B9E] font-mono text-[10px] uppercase tracking-widest hidden sm:inline">{name}</span>
    </div>
  );
};

// ─────────────────────────────────────────────
// EDITABLE LABEL
// ─────────────────────────────────────────────

const EditableLabel = ({ id, currentLabel, onSave }: {
  id: string; currentLabel: string; onSave: (val: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(currentLabel);

  // Sync val when currentLabel changes externally
  if (!isEditing && val !== currentLabel) setVal(currentLabel);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    onSave(val); setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
        <input
          autoFocus type="text"
          className="bg-black/50 border border-white/20 rounded px-1 py-0.5 text-xs text-white w-24 focus:outline-none"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          maxLength={64}
        />
        <button onClick={handleSave} className="text-green-400"><Check size={12} /></button>
        <button onClick={() => setIsEditing(false)} className="text-red-400"><X size={12} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group/label">
      <span className={currentLabel ? "text-white font-mono text-xs" : "text-zinc-400 text-xs"}>
        {currentLabel || id}
      </span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }}
        className={`text-zinc-600 hover:text-white transition-colors ${currentLabel ? 'opacity-0 group-hover/label:opacity-100' : 'opacity-100'}`}
      >
        <Pencil size={10} />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────
// LOCK ROW
// ─────────────────────────────────────────────

export function LockRow({ lockId, chainId, index }: {
  lockId: bigint; chainId: number; index: number;
}) {
  const activeContract = getContractAddress(chainId);
  const { labels, setLabel } = useLabels();
  const { archived, toggleArchive } = useArchived();

  const { data: lock, isLoading } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'locks',
    args: [lockId],
    chainId: chainId,
    query: { enabled: !!activeContract },
  });

  const tokenAddress = lock ? lock[0] : undefined;
  const { data: tokenData } = useReadContracts({
    contracts: [{ address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: chainId }],
    query: { enabled: !!tokenAddress },
  });
  const { data: price } = useTokenPrice(chainId, tokenAddress);

  if (isLoading || !lock) {
    return (
      <div className="grid grid-cols-7 p-5 border-b border-[#1C1C26] animate-pulse">
        <div className="col-span-7 h-4 bg-white/5 rounded"></div>
      </div>
    );
  }

  const rawAmount   = lock[1];
  const decimals    = Number(lock[3] || 18);
  const isWithdrawn = lock[4];
  const unlockTime  = Number(lock[5]);

  const tokenSymbol     = tokenData?.[0]?.result?.toString() || "ERC20";
  const amountFormatted = Number(formatUnits(rawAmount, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const usdValue        = price && price > 0
    ? (Number(formatUnits(rawAmount, decimals)) * price).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    : null;

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

  const fancyId   = formatLockId(lockId, chainId);
  const userLabel = labels[fancyId] || "";
  const isArchived = archived.includes(fancyId);

  return (
    // FIX D7: No target="_blank" — same tab navigation for own dashboard
    <Link
      href={`/lock/${fancyId}`}
      className="grid grid-cols-7 min-w-[900px] p-5 border-b border-[#1C1C26] text-sm font-mono hover:bg-white/[0.02] transition-colors cursor-pointer group items-center"
    >
      <div className="text-zinc-500 text-xs">{index}.</div>
      <div className="flex flex-col">
        <EditableLabel id={fancyId} currentLabel={userLabel} onSave={(name) => setLabel(fancyId, name)} />
        {userLabel && <span className="text-[9px] text-zinc-600 mt-1">{fancyId}</span>}
      </div>
      <div><NetworkBadge chainId={chainId} /></div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white">T</div>
        <span className="text-zinc-300">{tokenSymbol}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-white text-xs">{amountFormatted}</span>
        <span className="text-[9px] text-green-500/70 mt-1">{usdValue ? `≈ ${usdValue}` : "--"}</span>
      </div>
      <div>{statusDisplay}</div>
      <div className="flex items-center">
        {isWithdrawn ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArchive(fancyId); }}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] uppercase tracking-widest"
          >
            <Archive size={12} /> {isArchived ? "Unarchive" : "Archive"}
          </button>
        ) : (
          <span className="text-zinc-600">--</span>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// VESTING ROW
// ─────────────────────────────────────────────

export function VestingRow({ vestingId, chainId, index }: {
  vestingId: bigint; chainId: number; index: number;
}) {
  // FIX D2: Same address logic as LockRow
  const activeContract = getContractAddress(chainId);
  const { labels, setLabel } = useLabels();
  const { archived, toggleArchive } = useArchived();

  const { data: vest, isLoading } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'vestings',
    args: [vestingId],
    chainId: chainId,
    query: { enabled: !!activeContract },
  });

  const tokenAddress = vest ? vest[0] : undefined;
  const { data: tokenData } = useReadContracts({
    contracts: [{ address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: chainId }],
    query: { enabled: !!tokenAddress },
  });
  const { data: price } = useTokenPrice(chainId, tokenAddress);

  if (isLoading || !vest) {
    return (
      <div className="grid grid-cols-7 p-5 border-b border-[#1C1C26] animate-pulse">
        <div className="col-span-7 h-4 bg-white/5 rounded"></div>
      </div>
    );
  }

  const decimals      = Number(vest[3] || 18);
  const totalRaw      = vest[1];
  const claimedRaw    = vest[4];
  const startTime     = Number(vest[5]);
  const cliffDuration = Number(vest[6]);
  const duration      = Number(vest[7]);

  const tokenSymbol   = tokenData?.[0]?.result?.toString() || "ERC20";
  const totalAmount   = Number(formatUnits(totalRaw, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const isFullyClaimed = claimedRaw >= totalRaw;
  const usdValue      = price && price > 0
    ? (Number(formatUnits(totalRaw, decimals)) * price).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
    : null;

  // FIX D3: Detect cliff period for correct status display
  const now      = Math.floor(Date.now() / 1000);
  const cliffEnd = startTime + cliffDuration;
  const vestEnd  = new Date((cliffEnd + duration) * 1000);
  const inCliff  = now < cliffEnd && !isFullyClaimed;

  let statusDisplay;
  if (isFullyClaimed) {
    statusDisplay = <span className="text-[#555566] text-[10px] uppercase tracking-widest line-through">COMPLETED</span>;
  } else if (inCliff) {
    // FIX D3: Show "In Cliff" instead of "Active" when nothing is claimable
    statusDisplay = (
      <div className="flex flex-col items-start">
        <span className="text-amber-400 text-[10px] uppercase tracking-widest">IN CLIFF</span>
        <span className="text-zinc-500 text-[9px] lowercase">
          ends {formatDistanceToNow(new Date(cliffEnd * 1000), { addSuffix: true })}
        </span>
      </div>
    );
  } else {
    const timeString = formatDistanceToNow(vestEnd, { addSuffix: true });
    statusDisplay = (
      <div className="flex flex-col items-start">
        <span className="text-blue-400 text-[10px] uppercase tracking-widest">ACTIVE</span>
        <span className="text-zinc-500 text-[9px] lowercase">ends {timeString}</span>
      </div>
    );
  }

  const fancyId    = formatVestingId(vestingId, chainId);
  const userLabel  = labels[fancyId] || "";
  const isArchived = archived.includes(fancyId);

  return (
    <Link
      href={`/vesting/${fancyId}`}
      className="grid grid-cols-7 min-w-[900px] p-5 border-b border-[#1C1C26] text-sm font-mono hover:bg-white/[0.02] transition-colors cursor-pointer group items-center"
    >
      <div className="text-zinc-500 text-xs">{index}.</div>
      <div className="flex flex-col">
        <EditableLabel id={fancyId} currentLabel={userLabel} onSave={(name) => setLabel(fancyId, name)} />
        {userLabel && <span className="text-[9px] text-zinc-600 mt-1">{fancyId}</span>}
      </div>
      <div><NetworkBadge chainId={chainId} /></div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white">V</div>
        <span className="text-zinc-300">{tokenSymbol}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-white text-xs">{totalAmount}</span>
        <span className="text-[9px] text-green-500/70 mt-1">{usdValue ? `≈ ${usdValue}` : "--"}</span>
      </div>
      <div>{statusDisplay}</div>
      <div className="flex items-center">
        {isFullyClaimed ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArchive(fancyId); }}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] uppercase tracking-widest"
          >
            <Archive size={12} /> {isArchived ? "Unarchive" : "Archive"}
          </button>
        ) : (
          <span className="text-zinc-600">--</span>
        )}
      </div>
    </Link>
  );
}