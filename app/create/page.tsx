'use client';

import { useState, useEffect } from "react";
import { Calendar, Clock, Loader2, Check, CheckCircle2, Hourglass, Info, X, AlertTriangle, ExternalLink } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from "wagmi";
import { parseUnits, parseEther, isAddress, erc20Abi, decodeEventLog } from "viem";
import { CONTRACT_ADDRESSES, CONTRACT_ABI } from "@/lib/contract";
import { formatLockId, formatVestingId, getExplorerTxLink } from "@/lib/formatter";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const InfoPopup = ({ title, description, onClose, className = "" }: {
  title: string;
  description: string;
  onClose: () => void;
  className?: string;
}) => (
  <div
    className={`absolute z-50 w-64 p-4 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 ${className}`}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="flex justify-between items-start mb-2 border-b border-white/10 pb-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white">{title}</span>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-zinc-500 hover:text-white transition-colors">
        <X size={12} />
      </button>
    </div>
    <p className="text-xs text-zinc-400 font-sans leading-relaxed">{description}</p>
  </div>
);

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();

  // Check if current chain is supported
  const activeContract = chain?.id ? CONTRACT_ADDRESSES[chain.id] : undefined;
  const isChainSupported = !!activeContract;

  const [activeTab, setActiveTab] = useState<'lock' | 'vesting'>('lock');
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  // Form inputs
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [vestingDays, setVestingDays] = useState("365");
  const [cliffDays, setCliffDays] = useState("");

  // Transaction state
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [actionType, setActionType] = useState<'approve' | 'lock' | 'vesting' | null>(null);
  const [isSuccessScreen, setIsSuccessScreen] = useState(false);
  const [completedId, setCompletedId] = useState<string | null>(null);

  // ── READ FEES FROM CONTRACT (never hardcode) ──────────
  const { data: lockFeeData } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'LOCK_FEE',
    query: { enabled: isChainSupported },
  });
  const { data: vestingFeeData } = useReadContract({
    address: activeContract,
    abi: CONTRACT_ABI,
    functionName: 'VESTING_FEE',
    query: { enabled: isChainSupported },
  });

  const lockFee    = lockFeeData    ?? parseEther("0.03");
  const vestingFee = vestingFeeData ?? parseEther("0.02");
  const feeAmount  = activeTab === 'lock'
    ? (lockFeeData    ? (Number(lockFee)    / 1e18).toString() : "0.03")
    : (vestingFeeData ? (Number(vestingFee) / 1e18).toString() : "0.02");

  // ── VALIDATION ────────────────────────────────────────
  const isAddressFilled   = tokenAddress.trim().length > 0;
  const isInvalidAddress  = isAddressFilled && !isAddress(tokenAddress);
  const isAmountFilled    = amount.trim().length > 0;
  const isInvalidAmount   = isAmountFilled && Number(amount) <= 0;
  const isTimeParadox     = unlockDate ? new Date(unlockDate).getTime() <= Date.now() : false;
  const isInvalidDuration = vestingDays ? parseInt(vestingDays) <= 0 : false;
  const isInvalidCliff    = cliffDays ? parseInt(cliffDays) < 0 : false;

  // FIX F7: Cliff cannot be longer than or equal to vesting duration
  const isCliffTooLong = cliffDays && vestingDays
    ? parseInt(cliffDays) >= parseInt(vestingDays)
    : false;

  const isBaseInputValid  = isAddress(tokenAddress) && Number(amount) > 0;
  const isLockValid       = isBaseInputValid && activeTab === 'lock' && unlockDate && !isTimeParadox;
  const isVestingValid    = isBaseInputValid && activeTab === 'vesting' && vestingDays
    && !isInvalidDuration && !isInvalidCliff && !isCliffTooLong;
  const isInputValid      = isLockValid || isVestingValid;

  // ── TOKEN DATA ────────────────────────────────────────
  const { data: decimals } = useReadContract({
    address: isAddress(tokenAddress) ? tokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  const { data: tokenSymbol } = useReadContract({
    address: isAddress(tokenAddress) ? tokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: isAddress(tokenAddress) ? tokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && activeContract ? [address, activeContract] : undefined,
  });

  const { writeContract, data: writeHash, isPending: isWalletLoading, error: writeError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: writeHash });

  // ── TRANSACTION SUCCESS HANDLER ───────────────────────
  useEffect(() => {
    if (!isTxSuccess || !receipt) return;

    refetchAllowance();

    if (actionType === 'lock' && writeHash && chain?.id) {
      // FIX F6: Parse the Locked event to get the real lockId
      try {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CONTRACT_ABI,
              eventName: 'Locked',
              data: log.data,
              topics: log.topics,
            });
            const realLockId = (decoded.args as any).lockId;
            const fancyId = formatLockId(realLockId, chain.id);
            setCompletedId(fancyId);
            break;
          } catch { continue; }
        }
      } catch { /* fallback — no ID shown */ }

      setTxHash(writeHash);
      setIsSuccessScreen(true);
    }

    if (actionType === 'vesting' && writeHash && chain?.id) {
      // Parse the VestingCreated event to get the real vestingId
      try {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CONTRACT_ABI,
              eventName: 'VestingCreated',
              data: log.data,
              topics: log.topics,
            });
            const realVestingId = (decoded.args as any).vestingId;
            const fancyId = formatVestingId(realVestingId, chain.id);
            setCompletedId(fancyId);
            break;
          } catch { continue; }
        }
      } catch { /* fallback */ }

      setTxHash(writeHash);
      setIsSuccessScreen(true);
    }

    setActionType(null);
  }, [isTxSuccess, receipt, actionType, writeHash, chain?.id, refetchAllowance]);

  const finalDecimals    = decimals || 18;
  const amountInWei      = amount ? parseUnits(amount, finalDecimals) : BigInt(0);
  const currentAllowance = allowance || BigInt(0);
  const needsApproval    = amountInWei > BigInt(0) && amountInWei > currentAllowance;
  const isBusy           = isWalletLoading || isTxConfirming;
  const displaySymbol    = tokenSymbol ? String(tokenSymbol) : "TOKEN";

  // ── HANDLERS ─────────────────────────────────────────
  const handleApprove = () => {
    if (!isInputValid || !activeContract) return;
    setActionType('approve');
    writeContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [activeContract, amountInWei],
    });
  };

  const handleLock = () => {
    if (!isInputValid || !activeContract) return;
    setActionType('lock');

    if (activeTab === 'lock') {
      const unlockTimestamp = Math.floor(new Date(unlockDate).getTime() / 1000);
      writeContract({
        address: activeContract,
        abi: CONTRACT_ABI,
        functionName: 'lockToken',
        args: [tokenAddress as `0x${string}`, amountInWei, BigInt(unlockTimestamp)],
        value: lockFee,  // FIX F1: read from contract, not hardcoded
      });
    } else {
      const durationSeconds = BigInt(parseInt(vestingDays) * 24 * 60 * 60);
      const cliffSeconds    = cliffDays ? BigInt(parseInt(cliffDays) * 24 * 60 * 60) : BigInt(0);
      writeContract({
        address: activeContract,
        abi: CONTRACT_ABI,
        functionName: 'createVesting',
        args: [tokenAddress as `0x${string}`, amountInWei, cliffSeconds, durationSeconds],
        value: vestingFee,  // FIX F1: read from contract, not hardcoded
      });
    }
  };

  const handleNetworkSwitch = (targetChainId: number) => {
    if (switchChain) switchChain({ chainId: targetChainId });
  };

  // ── SUCCESS SCREEN ────────────────────────────────────
  if (isSuccessScreen) {
    return (
      <main className="min-h-full px-6 md:px-12 py-20 max-w-7xl mx-auto flex flex-col items-center justify-center">
        <div className="bg-[#13131A] border border-[#1C1C26] p-10 md:p-14 rounded-2xl flex flex-col items-center text-center max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4">

          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_20px_rgba(74,222,128,0.15)]">
            <CheckCircle2 className="text-green-400 w-10 h-10" />
          </div>

          <h2 className="text-3xl font-chakra font-bold text-white mb-3 uppercase tracking-tight">
            Protocol Secured
          </h2>

          {completedId && (
            <p className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest mb-2">
              ID: {completedId}
            </p>
          )}

          <p className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest mb-10 leading-relaxed">
            Your transaction has been confirmed on the blockchain.
          </p>

          <div className="w-full space-y-4">
            {/* FIX F9: Route to the actual certificate page using real ID */}
            {completedId && (
              <button
                onClick={() => {
                  const path = completedId.includes('L')
                    ? `/lock/${completedId}`
                    : `/vesting/${completedId}`;
                  router.push(path);
                }}
                className="w-full btn-primary py-4 text-sm"
              >
                View Certificate
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full btn-ghost py-3 text-sm"
            >
              Go to My Vaults
            </button>

            {txHash && chain?.id && (
              
                <a href={getExplorerTxLink(chain.id, txHash)}
                target="_blank"
                rel="noreferrer"
                className="w-full btn-ghost flex items-center justify-center gap-2 py-3"
              >
                View Transaction <ExternalLink size={14} />
              </a>
            )}
          </div>

          <button
            onClick={() => {
              setIsSuccessScreen(false);
              setTokenAddress("");
              setAmount("");
              setCompletedId(null);
            }}
            className="mt-8 text-[#555566] hover:text-white transition-colors font-mono text-[10px] uppercase tracking-widest"
          >
            Initialize Another Vault
          </button>
        </div>
      </main>
    );
  }

  // ── DISCONNECTED STATE ────────────────────────────────
  // FIX F3: Show clear message instead of broken form
  if (!isConnected) {
    return (
      <main className="min-h-full px-6 md:px-12 py-20 max-w-7xl mx-auto flex flex-col items-center justify-center">
        <div className="bg-[#13131A] border border-[#1C1C26] p-10 rounded-2xl flex flex-col items-center text-center max-w-md w-full">
          <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-6 border border-purple-500/20">
            <AlertTriangle className="text-purple-400 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-chakra font-bold text-white mb-3 uppercase tracking-tight">
            Connect Wallet
          </h2>
          <p className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest leading-relaxed">
            Please connect your wallet to initialize a vault.
          </p>
        </div>
      </main>
    );
  }

  // ── UNSUPPORTED CHAIN STATE ───────────────────────────
  // FIX F2: Block form on unsupported chain instead of silently using testnet
  if (!isChainSupported) {
    return (
      <main className="min-h-full px-6 md:px-12 py-20 max-w-7xl mx-auto flex flex-col items-center justify-center">
        <div className="bg-[#13131A] border border-[#1C1C26] p-10 rounded-2xl flex flex-col items-center text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
            <AlertTriangle className="text-red-400 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-chakra font-bold text-white mb-3 uppercase tracking-tight">
            Unsupported Network
          </h2>
          <p className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest mb-8 leading-relaxed">
            Please switch to a supported network to continue.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { id: 8453,  name: "BASE"      },
              { id: 42161, name: "ARBITRUM"  },
              { id: 10,    name: "OPTIMISM"  },
            ].map(net => (
              <button
                key={net.id}
                onClick={() => handleNetworkSwitch(net.id)}
                className="px-4 py-2 rounded-lg border border-[#1C1C26] bg-[#1A1A24] text-[#8B8B9E] font-mono text-[10px] uppercase tracking-widest hover:text-white hover:border-white/20 transition-all"
              >
                {net.name}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── MAIN FORM ─────────────────────────────────────────
  return (
    <main className="min-h-full px-6 md:px-12 py-10 max-w-7xl mx-auto" onClick={() => setOpenInfo(null)}>

      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-chakra font-bold text-white tracking-tight mb-2">
          Initialize <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Protocol</span>
        </h1>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-8">
        <div className="relative w-64">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab('lock'); }}
            className={`w-full py-3.5 px-6 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all flex items-center justify-between border ${activeTab === 'lock' ? 'bg-white text-black border-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#13131A] text-[#8B8B9E] border-[#1C1C26] hover:bg-[#1A1A24]'}`}
          >
            Standard Lock
            <Info size={14} className={activeTab === 'lock' ? 'text-zinc-500' : 'text-[#555566]'} onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === 'lock' ? null : 'lock'); }} />
          </button>
          {openInfo === 'lock' && (
            <InfoPopup title="Standard Lock" description="Tokens are 100% locked until the specific date. Withdrawal is impossible before the unlock time." className="top-full left-0 mt-2" onClose={() => setOpenInfo(null)} />
          )}
        </div>
        <div className="relative w-64">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab('vesting'); }}
            className={`w-full py-3.5 px-6 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all flex items-center justify-between border ${activeTab === 'vesting' ? 'bg-white text-black border-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#13131A] text-[#8B8B9E] border-[#1C1C26] hover:bg-[#1A1A24]'}`}
          >
            Linear Vesting
            <Info size={14} className={activeTab === 'vesting' ? 'text-zinc-500' : 'text-[#555566]'} onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === 'vesting' ? null : 'vesting'); }} />
          </button>
          {openInfo === 'vesting' && (
            <InfoPopup title="Linear Vesting" description="Tokens unlock gradually over time. You can claim unlocked tokens at any time after the cliff period." className="top-full left-0 mt-2" onClose={() => setOpenInfo(null)} />
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* LEFT COLUMN */}
        <div className="flex-1 w-full space-y-6">

          {/* 1. NETWORK */}
          <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-white font-medium text-lg font-sans">1. Network</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 8453,    name: "BASE",          color: "bg-blue-500"  },
                { id: 42161,   name: "ARBITRUM",      color: "bg-blue-400"  },
                { id: 10,      name: "OPTIMISM",      color: "bg-red-500"   },
                { id: 84532,   name: "BASE SEPOLIA",  color: "bg-blue-600"  },
                { id: 421614,  name: "ARB SEPOLIA",   color: "bg-blue-300"  },
                { id: 11155420,name: "OP SEPOLIA",    color: "bg-red-400"   },
              ].map(net => (
                <button
                  key={net.id}
                  onClick={() => handleNetworkSwitch(net.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${chain?.id === net.id ? 'bg-[#1C1C26] border-white/20' : 'bg-transparent border-[#1C1C26] hover:border-white/10 opacity-60 hover:opacity-100'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${net.color}`}></div>
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${chain?.id === net.id ? 'text-white' : 'text-[#8B8B9E]'}`}>{net.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. TOKEN AMOUNT */}
          <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-white font-medium text-lg font-sans">2. Token Amount</h2>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-[#555566] uppercase tracking-widest">Token Address</label>
                <input
                  type="text" placeholder="0x..."
                  className={`w-full bg-[#0B0B0F] border rounded-xl p-4 text-white focus:outline-none font-mono transition-colors text-sm ${isInvalidAddress ? 'border-red-500/50 focus:border-red-500' : 'border-[#1C1C26] focus:border-purple-500/50'}`}
                  value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)}
                />
                {isInvalidAddress && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Invalid ERC-20 Address</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-[#555566] uppercase tracking-widest">Amount</label>
                <input
                  type="number" placeholder="1,000"
                  className={`w-full bg-[#0B0B0F] border rounded-xl p-4 text-white focus:outline-none font-mono transition-colors text-sm ${isInvalidAmount ? 'border-red-500/50 focus:border-red-500' : 'border-[#1C1C26] focus:border-purple-500/50'}`}
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                />
                {isInvalidAmount && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Amount must be greater than 0</p>}
              </div>
            </div>
          </div>

          {/* 3. DURATION */}
          <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-white font-medium text-lg font-sans">3. Duration</h2>
            </div>

            {activeTab === 'lock' ? (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="datetime-local"
                    className={`w-full bg-[#0B0B0F] border rounded-xl p-4 text-white focus:outline-none font-mono transition-colors text-sm ${isTimeParadox ? 'border-red-500/50 focus:border-red-500' : 'border-[#1C1C26] focus:border-purple-500/50'}`}
                    value={unlockDate} onChange={(e) => setUnlockDate(e.target.value)}
                  />
                  <Calendar className="absolute right-4 top-4 text-[#555566] pointer-events-none" size={20} />
                </div>
                {isTimeParadox && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Unlock date must be in the future</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-[#555566] uppercase tracking-widest">Vesting (Days)</label>
                  <div className="relative">
                    <input
                      type="number" placeholder="365"
                      className={`w-full bg-[#0B0B0F] border rounded-xl p-4 text-white focus:outline-none font-mono transition-colors text-sm ${isInvalidDuration ? 'border-red-500/50 focus:border-red-500' : 'border-[#1C1C26] focus:border-purple-500/50'}`}
                      value={vestingDays} onChange={(e) => setVestingDays(e.target.value)}
                    />
                    <Clock className="absolute right-4 top-4 text-[#555566] pointer-events-none" size={20} />
                  </div>
                  {isInvalidDuration && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Must be at least 1 day</p>}
                </div>
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-mono text-[#555566] uppercase tracking-widest">Cliff (Days) — Optional</label>
                  <div className="relative">
                    <input
                      type="number" placeholder="0"
                      className={`w-full bg-[#0B0B0F] border rounded-xl p-4 text-white focus:outline-none font-mono transition-colors text-sm ${isInvalidCliff || isCliffTooLong ? 'border-red-500/50 focus:border-red-500' : 'border-[#1C1C26] focus:border-purple-500/50'}`}
                      value={cliffDays} onChange={(e) => setCliffDays(e.target.value)}
                    />
                    <Hourglass className="absolute right-4 top-4 text-[#555566] pointer-events-none" size={20} />
                  </div>
                  {isInvalidCliff   && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Cannot be negative</p>}
                  {isCliffTooLong   && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Cliff must be shorter than vesting duration</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0 sticky top-24">
          <div className="bg-gradient-to-b from-[#13131A] to-[#0B0B0F] border border-[#1C1C26] rounded-2xl p-6">
            <h3 className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest mb-6">
              {activeTab === 'lock' ? 'Lock Summary' : 'Vesting Summary'}
            </h3>

            <div className="space-y-5 mb-8">
              <div className="flex justify-between items-end">
                <span className="text-xs text-[#555566] font-sans">Asset</span>
                <span className="text-white font-bold text-lg font-sans">{displaySymbol}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#555566] font-sans">Quantity</span>
                <span className="text-white font-mono text-sm">{amount || "0.00"}</span>
              </div>
              {activeTab === 'lock' ? (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#555566] font-sans">Unlock Date</span>
                  <span className="text-white font-mono text-sm">{unlockDate ? new Date(unlockDate).toLocaleDateString() : "--"}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#555566] font-sans">Cliff Duration</span>
                    <span className="text-white font-mono text-sm">{cliffDays ? `${cliffDays} Days` : "--"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#555566] font-sans">Vesting Duration</span>
                    <span className="text-white font-mono text-sm">{vestingDays ? `${vestingDays} Days` : "--"}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <span className="text-xs text-[#555566] font-sans">Service Fee</span>
                <span className="text-blue-400 font-mono text-sm">{feeAmount} ETH</span>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleApprove}
                disabled={!needsApproval || !isInputValid || isBusy}
                className={`w-full flex items-center justify-center gap-2 ${needsApproval && isInputValid ? 'btn-secondary' : 'btn-ghost opacity-50 cursor-not-allowed border-0 bg-transparent py-3'}`}
              >
                {actionType === 'approve' && isBusy ? (
                  <><Loader2 className="animate-spin" size={14} />{isTxConfirming ? "Confirming..." : "Signing..."}</>
                ) : !needsApproval && isInputValid && amount ? (
                  <span className="flex items-center gap-2 text-green-400 font-mono"><Check size={14} /> 1. Authorized</span>
                ) : "1. Authorize"}
              </button>

              <button
                onClick={handleLock}
                disabled={needsApproval || !isInputValid || isBusy}
                className={`w-full flex items-center justify-center gap-2 ${!needsApproval && isInputValid ? 'btn-primary py-4 text-sm' : 'bg-[#1A1A24] text-[#555566] font-mono text-sm py-4 rounded-xl cursor-not-allowed transition-all border border-transparent'}`}
              >
                {actionType === 'lock' && isBusy ? (
                  <><Loader2 className="animate-spin" size={16} />{isTxConfirming ? "Securing..." : "Signing..."}</>
                ) : (`2. INITIALIZE ${activeTab === 'lock' ? 'LOCK' : 'VESTING'}`)}
              </button>

              {/* FIX F8: Show actual error message */}
              {writeError && (
                <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest text-center mt-2">
                  {(writeError as any).shortMessage || "Transaction failed. Try again."}
                </p>
              )}
            </div>
          </div>

          <div className="bg-[#1A1A0F]/30 border border-[#403010] p-5 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={16} className="text-[#E0A831] shrink-0 mt-0.5" />
            <div className="text-[10px] text-[#A68843] font-sans leading-relaxed">
              <strong className="text-[#E0A831] font-mono uppercase">Caution:</strong> DO NOT LOCK "Rebasing" or "Elastic Supply" tokens.
              The contract logic supports standard tax tokens (Deflationary), but dynamic balance updates may cause funds to become permanently stuck.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}