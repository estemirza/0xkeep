'use client';

import { useState, useEffect } from "react";
import { Calendar, Clock, Loader2, Check, CheckCircle2, Hourglass, Info, X, AlertTriangle, ExternalLink } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from "wagmi";
import { parseUnits, parseEther, isAddress, erc20Abi } from "viem";
import { CONTRACT_ADDRESSES, CONTRACT_ABI } from "@/lib/contract";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const getContractAddress = (chainId?: number) => {
  return CONTRACT_ADDRESSES[chainId || 84532] || CONTRACT_ADDRESSES[84532];
};

const getExplorerTxLink = (chainId: number, hash: string) => {
    switch (chainId) {
        case 8453: return `https://basescan.org/tx/${hash}`;
        case 42161: return `https://arbiscan.io/tx/${hash}`;
        case 10: return `https://optimistic.etherscan.io/tx/${hash}`;
        default: return `https://sepolia.basescan.org/tx/${hash}`;
    }
};

const InfoPopup = ({ title, description, onClose, className = "" }: { title: string, description: string, onClose: () => void, className?: string }) => (
  <div className={`absolute z-50 w-64 p-4 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 ${className}`} onClick={(e) => e.stopPropagation()}>
    <div className="flex justify-between items-start mb-2 border-b border-white/10 pb-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white">{title}</span>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-zinc-500 hover:text-white transition-colors"><X size={12} /></button>
    </div>
    <p className="text-xs text-zinc-400 font-sans leading-relaxed">{description}</p>
  </div>
);

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const activeContract = getContractAddress(chain?.id);

  const[activeTab, setActiveTab] = useState<'lock' | 'vesting'>('lock');
  const[openInfo, setOpenInfo] = useState<string | null>(null);
  
  // Inputs
  const[tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const[unlockDate, setUnlockDate] = useState("");
  const [vestingDays, setVestingDays] = useState("365");
  const [cliffDays, setCliffDays] = useState("");

  // Logic State
  const[txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const[actionType, setActionType] = useState<'approve' | 'lock' | null>(null);
  const[isSuccessScreen, setIsSuccessScreen] = useState(false);

  // --- VALIDATION STATE ---
  const isAddressFilled = tokenAddress.trim().length > 0;
  const isInvalidAddress = isAddressFilled && !isAddress(tokenAddress);
  const isAmountFilled = amount.trim().length > 0;
  const isInvalidAmount = isAmountFilled && Number(amount) <= 0;
  const isTimeParadox = unlockDate ? new Date(unlockDate).getTime() <= Date.now() : false;
  const isInvalidDuration = vestingDays ? parseInt(vestingDays) <= 0 : false;
  const isInvalidCliff = cliffDays ? parseInt(cliffDays) < 0 : false;

  const isBaseInputValid = isAddress(tokenAddress) && Number(amount) > 0;
  const isLockValid = isBaseInputValid && activeTab === 'lock' && unlockDate && !isTimeParadox;
  const isVestingValid = isBaseInputValid && activeTab === 'vesting' && vestingDays && !isInvalidDuration && !isInvalidCliff;
  const isInputValid = isLockValid || isVestingValid;

  // --- BLOCKCHAIN HOOKS ---
  const { data: decimals } = useReadContract({
    address: isAddress(tokenAddress) ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const { data: tokenSymbol } = useReadContract({
    address: isAddress(tokenAddress) ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: isAddress(tokenAddress) ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, activeContract] : undefined,
  });

  const { writeContract, data: writeHash, isPending: isWalletLoading, error: writeError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: writeHash });

  // --- LOGIC & VALIDATION ---
  useEffect(() => {
    if (isTxSuccess) {
      refetchAllowance();
      if (actionType === 'lock' && writeHash) {
        setTxHash(writeHash);
        setIsSuccessScreen(true); // Triggers the success UI
      }
      setActionType(null);
    }
  }, [isTxSuccess, refetchAllowance, actionType, writeHash]);

  const finalDecimals = decimals || 18;
  const amountInWei = amount ? parseUnits(amount, finalDecimals) : BigInt(0);
  const currentAllowance = allowance || BigInt(0);
  const needsApproval = amountInWei > BigInt(0) && amountInWei > currentAllowance;

  // --- HANDLERS ---
  const handleApprove = () => {
    if (!isInputValid) return;
    setActionType('approve');
    writeContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [activeContract, amountInWei],
    });
  };

  const handleLock = () => {
    if (!isInputValid) return;
    setActionType('lock');

    if (activeTab === 'lock') {
        const unlockTimestamp = Math.floor(new Date(unlockDate).getTime() / 1000);
        writeContract({
            address: activeContract,
            abi: CONTRACT_ABI,
            functionName: 'lockToken',
            args: [tokenAddress as `0x${string}`, amountInWei, BigInt(unlockTimestamp)],
            value: parseEther("0.03"), // Standard Lock Price
        });
    } else {
        const durationSeconds = BigInt(parseInt(vestingDays) * 24 * 60 * 60);
        const cliffSeconds = cliffDays ? BigInt(parseInt(cliffDays) * 24 * 60 * 60) : BigInt(0);
        writeContract({
            address: activeContract,
            abi: CONTRACT_ABI,
            functionName: 'createVesting',
            args:[tokenAddress as `0x${string}`, amountInWei, cliffSeconds, durationSeconds],
            value: parseEther("0.02"), // Vesting Price
        });
    }
  };

  const handleNetworkSwitch = (targetChainId: number) => {
      if (switchChain) {
          switchChain({ chainId: targetChainId });
      }
  };

  // UI Helpers
  const isBusy = isWalletLoading || isTxConfirming;
  const feeAmount = activeTab === 'lock' ? '0.03' : '0.02';
  const displaySymbol = tokenSymbol ? String(tokenSymbol) : "TOKEN";

  // --- SUCCESS SCREEN ---
  if (isSuccessScreen) {
    return (
      <main className="min-h-full px-6 md:px-12 py-20 max-w-7xl mx-auto flex flex-col items-center justify-center">
        <div className="bg-[#13131A] border border-[#1C1C26] p-10 md:p-14 rounded-2xl flex flex-col items-center text-center max-w-md w-full shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_20px_rgba(74,222,128,0.15)]">
                <CheckCircle2 className="text-green-400 w-10 h-10" />
            </div>
            
            <h2 className="text-3xl font-chakra font-bold text-white mb-3 uppercase tracking-tight">Protocol Secured</h2>
            
            <p className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest mb-10 leading-relaxed">
                Your transaction has been confirmed on the blockchain.
            </p>

            <div className="w-full space-y-4">
                <button 
                    onClick={() => router.push('/')} 
                    className="w-full btn-primary py-4 text-sm"
                >
                    Go to My Vaults
                </button>
                
                {txHash && (
                    <a 
                        href={getExplorerTxLink(chain?.id || 84532, txHash)} 
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
                }} 
                className="mt-8 text-[#555566] hover:text-white transition-colors font-mono text-[10px] uppercase tracking-widest"
            >
                Initialize Another Vault
            </button>

        </div>
      </main>
    );
  }
  
  return (
    <main className="min-h-full px-6 md:px-12 py-10 max-w-7xl mx-auto" onClick={() => setOpenInfo(null)}>
    
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-chakra font-bold text-white tracking-tight mb-2">
          Initialize <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Protocol</span>
        </h1>
      </div>

      {/* TOP TABS */}
      <div className="flex gap-2 mb-8">
          <div className="relative w-64">
              <button 
                  onClick={(e) => { e.stopPropagation(); setActiveTab('lock'); }} 
                  className={`w-full py-3.5 px-6 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all flex items-center justify-between border ${activeTab === 'lock' ? 'bg-white text-black border-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#13131A] text-[#8B8B9E] border-[#1C1C26] hover:bg-[#1A1A24]'}`}
              >
                  Standard Lock
                  <Info size={14} className={`${activeTab === 'lock' ? 'text-zinc-500' : 'text-[#555566]'}`} onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === 'lock' ? null : 'lock'); }}/>
              </button>
              {openInfo === 'lock' && <InfoPopup title="Standard Lock" description="Tokens are 100% locked until the specific date. Withdrawal is impossible before the unlock time." className="top-full left-0 mt-2" onClose={() => setOpenInfo(null)}/>}
          </div>
          <div className="relative w-64">
              <button 
                  onClick={(e) => { e.stopPropagation(); setActiveTab('vesting'); }} 
                  className={`w-full py-3.5 px-6 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-all flex items-center justify-between border ${activeTab === 'vesting' ? 'bg-white text-black border-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#13131A] text-[#8B8B9E] border-[#1C1C26] hover:bg-[#1A1A24]'}`}
              >
                  Linear Vesting
                  <Info size={14} className={`${activeTab === 'vesting' ? 'text-zinc-500' : 'text-[#555566]'}`} onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === 'vesting' ? null : 'vesting'); }}/>
              </button>
              {openInfo === 'vesting' && <InfoPopup title="Linear Vesting" description="Tokens unlock gradually over time. You can claim unlocked tokens at any time." className="top-full left-0 mt-2" onClose={() => setOpenInfo(null)}/>}
          </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* LEFT COLUMN: FORM INPUTS */}
        <div className="flex-1 w-full space-y-6">
            
            {/* 1. NETWORK SELECTION */}
            <div className="bg-[#13131A] border border-[#1C1C26] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.99967 19.0011C10.2797 19.0011 10.5387 18.8741 11.0578 18.6191L15.2301 16.5749C17.0772 15.6698 18.0003 15.2168 18.0003 14.5007V5.5M9.99967 19.0011C9.71965 19.0011 9.46063 18.8741 8.94159 18.6191L4.76925 16.5749C2.9221 15.6698 1.99902 15.2168 1.99902 14.5007V5.5M9.99967 19.0011V10.0004" stroke="#BD9DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8.94159 1.38203C9.46163 1.12701 9.72065 1 9.99967 1C10.2797 1 10.5387 1.12701 11.0578 1.38203L15.2301 3.4262C17.0772 4.33127 18.0003 4.78431 18.0003 5.50037C18.0003 6.21642 17.0772 6.66946 15.2301 7.57454L11.0578 9.6187C10.5377 9.87372 10.2787 10.0007 9.99967 10.0007C9.71965 10.0007 9.46063 9.87372 8.94159 9.6187L4.76925 7.57454C2.9221 6.66946 1.99902 6.21642 1.99902 5.50037C1.99902 4.78431 2.9221 4.33127 4.76925 3.4262L8.94159 1.38203Z" stroke="#BD9DFF" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                    <h2 className="text-white font-medium text-lg font-sans">1. Network</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                    {[
                        { id: 8453, name: "BASE", color: "bg-blue-500" },
                        { id: 42161, name: "ARBITRUM", color: "bg-blue-400" },
                        { id: 10, name: "OPTIMISM", color: "bg-red-500" },
                        { id: 84532, name: "BASE (SEPOLIA)", color: "bg-blue-600" }
                    ].map(net => (
                        <button 
                            key={net.id} onClick={() => handleNetworkSwitch(net.id)}
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
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g clipPath="url(#clip0_13149_6)">
                        <path d="M10 0.5C12.5199 0.5 14.9369 1.50134 16.7188 3.2832C18.5005 5.06496 19.5018 7.48122 19.502 10.001C19.502 12.5209 18.5006 14.9379 16.7188 16.7197C14.9369 18.5016 12.5199 19.5029 10 19.5029C8.75241 19.5029 7.51689 19.2567 6.36426 18.7793C5.2116 18.3018 4.16445 17.6019 3.28223 16.7197C2.40002 15.8375 1.70014 14.7903 1.22266 13.6377C0.745165 12.4849 0.499023 11.2487 0.499023 10.001C0.499083 8.75339 0.745222 7.51786 1.22266 6.36523C1.70015 5.21257 2.40001 4.16542 3.28223 3.2832C4.16445 2.40098 5.2116 1.70112 6.36426 1.22363C7.51689 0.746199 8.75241 0.500059 10 0.5ZM10 1.28613C7.68861 1.28625 5.4723 2.20446 3.83789 3.83887C2.20348 5.47327 1.28528 7.68959 1.28516 10.001C1.28516 12.3125 2.20338 14.5295 3.83789 16.1641C5.47229 17.7984 7.68863 18.7167 10 18.7168C12.3116 18.7168 14.5286 17.7986 16.1631 16.1641C17.7976 14.5295 18.7158 12.3125 18.7158 10.001C18.7157 7.68961 17.7975 5.47327 16.1631 3.83887C14.5286 2.20435 12.3116 1.28613 10 1.28613ZM9.60742 14.2344L9.1543 14.1924C8.71718 14.1517 8.30052 13.9865 7.9541 13.7168C7.60768 13.4471 7.34584 13.0837 7.19922 12.6699L7.19629 12.6621L7.19336 12.6553L7.17188 12.5791C7.1674 12.5534 7.1653 12.5272 7.16602 12.501C7.16749 12.4484 7.18027 12.3965 7.20215 12.3486C7.22408 12.3007 7.25505 12.2572 7.29395 12.2217C7.33284 12.1861 7.37903 12.1591 7.42871 12.1416C7.47824 12.1242 7.53059 12.1169 7.58301 12.1201C7.63559 12.1234 7.68723 12.1366 7.73438 12.1602C7.78153 12.1837 7.82319 12.2168 7.85742 12.2568C7.89166 12.2969 7.91772 12.3433 7.93359 12.3936L7.93945 12.4111C8.04461 12.7053 8.2387 12.9598 8.49414 13.1396C8.71767 13.297 8.97889 13.3904 9.25 13.4111L9.36621 13.416H10.6426C11.0125 13.4115 11.3679 13.2713 11.6416 13.0225C11.9154 12.7735 12.0884 12.4324 12.1279 12.0645C12.1674 11.6964 12.0703 11.3259 11.8555 11.0244C11.6406 10.7232 11.3226 10.5114 10.9619 10.4287L10.957 10.4277L8.71484 9.93555H8.71387C8.2131 9.82634 7.76952 9.53735 7.46777 9.12305C7.16603 8.70869 7.02738 8.19766 7.07715 7.6875C7.12697 7.17742 7.36219 6.70364 7.73828 6.35547C8.11435 6.00734 8.60484 5.80925 9.11719 5.79883L9.60742 5.78906V4.28613C9.60742 4.18194 9.64898 4.08149 9.72266 4.00781C9.79622 3.93428 9.89599 3.8927 10 3.89258C10.1042 3.89258 10.2046 3.93415 10.2783 4.00781C10.352 4.08149 10.3936 4.18194 10.3936 4.28613V5.76562L10.8467 5.80762C11.2838 5.84826 11.7005 6.01351 12.0469 6.2832C12.3933 6.5529 12.6551 6.91625 12.8018 7.33008L12.8066 7.34082C12.8253 7.38978 12.8338 7.44276 12.832 7.49512C12.8302 7.54732 12.8178 7.59906 12.7959 7.64648C12.774 7.69383 12.7426 7.73631 12.7041 7.77148C12.6654 7.80676 12.6197 7.83408 12.5703 7.85156C12.5209 7.86905 12.4683 7.87611 12.416 7.87305C12.3638 7.86996 12.3126 7.85707 12.2656 7.83398C12.2186 7.81085 12.1769 7.77786 12.1426 7.73828C12.1083 7.69877 12.0817 7.6532 12.0654 7.60352L12.0625 7.59375C11.9592 7.29741 11.766 7.0406 11.5098 6.85938C11.254 6.67854 10.948 6.58204 10.6348 6.58301H9.16016C8.83739 6.58158 8.52516 6.69919 8.28418 6.91406C8.04231 7.12973 7.88919 7.42782 7.85449 7.75C7.81989 8.07236 7.90697 8.39697 8.09766 8.65918C8.28756 8.92006 8.56726 9.10092 8.88281 9.16797V9.16895L11.125 9.65723V9.6582C11.6601 9.77653 12.136 10.0819 12.4658 10.5195C12.7955 10.9571 12.9584 11.4981 12.9248 12.0449C12.8911 12.5918 12.6631 13.1091 12.2822 13.5029C11.9012 13.8968 11.3913 14.1416 10.8457 14.1934L10.3936 14.2363V15.7139C10.3936 15.8181 10.352 15.9185 10.2783 15.9922C10.2046 16.0659 10.1042 16.1074 10 16.1074C9.89599 16.1073 9.79622 16.0657 9.72266 15.9922C9.64898 15.9185 9.60742 15.8181 9.60742 15.7139V14.2344Z" fill="#BD9DFF" stroke="#BD9DFF"/>
                        </g>
                        <defs>
                        <clipPath id="clip0_13149_6">
                        <rect width="20" height="20" fill="white"/>
                        </clipPath>
                        </defs>
                    </svg>
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
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.3 14.7L14.7 13.3L11 9.6V5H9V10.4L13.3 14.7ZM10 20C8.61667 20 7.31667 19.7375 6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10C0 8.61667 0.2625 7.31667 0.7875 6.1C1.3125 4.88333 2.025 3.825 2.925 2.925C3.825 2.025 4.88333 1.3125 6.1 0.7875C7.31667 0.2625 8.61667 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20ZM10 18C12.2167 18 14.1042 17.2208 15.6625 15.6625C17.2208 14.1042 18 12.2167 18 10C18 7.78333 17.2208 5.89583 15.6625 4.3375C14.1042 2.77917 12.2167 2 10 2C7.78333 2 5.89583 2.77917 4.3375 4.3375C2.77917 5.89583 2 7.78333 2 10C2 12.2167 2.77917 14.1042 4.3375 15.6625C5.89583 17.2208 7.78333 18 10 18Z" fill="#BD9DFF"/>
                    </svg>
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
                            <label className="text-[10px] font-mono text-[#555566] uppercase tracking-widest">Cliff (Days) - Optional</label>
                            <div className="relative">
                                <input 
                                    type="number" placeholder="0" 
                                    className={`w-full bg-[#0B0B0F] border rounded-xl p-4 text-white focus:outline-none font-mono transition-colors text-sm ${isInvalidCliff ? 'border-red-500/50 focus:border-red-500' : 'border-[#1C1C26] focus:border-purple-500/50'}`}
                                    value={cliffDays} onChange={(e) => setCliffDays(e.target.value)} 
                                />
                                <Hourglass className="absolute right-4 top-4 text-[#555566] pointer-events-none" size={20} />
                            </div>
                            {isInvalidCliff && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest mt-1">Cannot be negative</p>}
                        </div>
                    </div>
                )}
            </div>

        </div>

        {/* RIGHT COLUMN: SUMMARY & ACTION */}
        <div className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0 sticky top-24">
            
            <div className="bg-gradient-to-b from-[#13131A] to-[#0B0B0F] border border-[#1C1C26] rounded-2xl p-6">
                <h3 className="text-[#8B8B9E] font-mono text-xs uppercase tracking-widest mb-6">
                    {activeTab === 'lock' ? 'Lock Summary' : 'Vesting Summary'}
                </h3>

                <div className="space-y-5 mb-8">
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-[#555566] font-sans">Asset</span>
                        <div className="text-right">
                            <span className="text-white font-bold text-lg font-sans">{displaySymbol}</span>
                            <div className="text-[9px] font-mono text-zinc-600 mt-0.5">ID: PENDING</div>
                        </div>
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
                        ) : ("1. Authorize")}
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
                    {writeError && <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest text-center mt-2">Tx Failed. Try Again.</p>}
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