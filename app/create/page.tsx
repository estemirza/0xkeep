'use client';

import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, Loader2, AlertTriangle, AlertCircle, Check, Hourglass, Info, X, Plus, Trash2, Layers } from "lucide-react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits, parseEther, isAddress, erc20Abi, formatUnits } from "viem";
import { CONTRACT_ADDRESSES, CONTRACT_ABI } from "@/lib/contract";

const getContractAddress = (chainId?: number) => {
  return CONTRACT_ADDRESSES[chainId || 84532] || CONTRACT_ADDRESSES[84532];
};

// HELPER: Info Popup
const InfoPopup = ({ title, description, onClose, className = "" }: { title: string, description: string, onClose: () => void, className?: string }) => (
  <div className={`absolute z-50 w-64 p-4 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 ${className}`} onClick={(e) => e.stopPropagation()}>
    <div className="flex justify-between items-start mb-2 border-b border-white/10 pb-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-white">{title}</span>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-zinc-500 hover:text-white transition-colors">
        <X size={12} />
      </button>
    </div>
    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
      {description}
    </p>
  </div>
);

// TYPE: Batch Item
type BatchItem = {
    amount: string;
    duration: string;
    cliff: string;
};

export default function CreatePage() {
  const { address, isConnected, chain } = useAccount();
  const activeContract = getContractAddress(chain?.id);

  const [activeTab, setActiveTab] = useState<'lock' | 'vesting'>('lock');
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  
  // Single Inputs
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [vestingDays, setVestingDays] = useState("1");
  const [cliffDays, setCliffDays] = useState("");

  // BATCH STATE
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([
      { amount: "", duration: "365", cliff: "" }
  ]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  // Logic State
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isSuccessScreen, setIsSuccessScreen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'lock' | null>(null);

  // --- BLOCKCHAIN HOOKS ---
  const { data: decimals } = useReadContract({
    address: isAddress(tokenAddress) ? tokenAddress : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: isAddress(tokenAddress) ? tokenAddress : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, activeContract] : undefined,
  });

  const { writeContractAsync, data: writeHash, isPending: isWalletLoading, error: writeError } = useWriteContract();

  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: writeHash || txHash,
  });

  // --- CALCULATIONS ---
  const finalDecimals = decimals || 18;

  let totalAmountWei = BigInt(0);
  if (isBatchMode && activeTab === 'vesting') {
      totalAmountWei = batchItems.reduce((acc, item) => {
          const val = item.amount ? parseUnits(item.amount, finalDecimals) : BigInt(0);
          return acc + val;
      }, BigInt(0));
  } else {
      totalAmountWei = amount ? parseUnits(amount, finalDecimals) : BigInt(0);
  }

  const currentAllowance = allowance || BigInt(0);
  const needsApproval = totalAmountWei > BigInt(0) && totalAmountWei > currentAllowance;

  // Validation
  const isValidAddress = isAddress(tokenAddress);
  const isTimeParadox = activeTab === 'lock' && unlockDate && new Date(unlockDate) < new Date();
  
  const isInvalidDuration = activeTab === 'vesting' && !isBatchMode && (!vestingDays || parseInt(vestingDays) <= 0);
  const isInvalidCliff = activeTab === 'vesting' && !isBatchMode && cliffDays && parseInt(cliffDays) < 0;

  const isBatchInvalid = isBatchMode && batchItems.some(item => 
      !item.amount || !item.duration || parseInt(item.duration) <= 0 || (item.cliff && parseInt(item.cliff) < 0)
  );

  const isInputValid = isValidAddress && 
                       (isBatchMode ? totalAmountWei > 0 && !isBatchInvalid : amount && !isTimeParadox && !isInvalidDuration && !isInvalidCliff);

  // --- HANDLERS ---
  useEffect(() => {
    if (isTxSuccess && actionType === 'approve') {
        refetchAllowance();
        setActionType(null);
    }
  }, [isTxSuccess, actionType, refetchAllowance]);

  const handleBatchChange = (index: number, field: keyof BatchItem, value: string) => {
      const newItems = [...batchItems];
      newItems[index][field] = value;
      setBatchItems(newItems);
  };

  const addBatchRow = () => {
      setBatchItems([...batchItems, { amount: "", duration: "365", cliff: "" }]);
  };

  const removeBatchRow = (index: number) => {
      if (batchItems.length > 1) {
          const newItems = batchItems.filter((_, i) => i !== index);
          setBatchItems(newItems);
      }
  };

  const handleApprove = async () => {
    if (!isInputValid) return;
    setActionType('approve');
    try {
        await writeContractAsync({
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [activeContract, totalAmountWei],
        });
    } catch (e) {
        console.error(e);
        setActionType(null);
    }
  };

  const handleLock = async () => {
    if (!isInputValid) return;
    setActionType('lock');

    try {
        if (activeTab === 'lock') {
            // STANDARD LOCK
            const unlockTimestamp = Math.floor(new Date(unlockDate).getTime() / 1000);
            const hash = await writeContractAsync({
                address: activeContract,
                abi: CONTRACT_ABI,
                functionName: 'lockToken',
                args: [tokenAddress as `0x${string}`, totalAmountWei, BigInt(unlockTimestamp)],
                value: parseEther("0.05"),
            });
            setTxHash(hash);
            setIsSuccessScreen(true);

        } else if (!isBatchMode) {
            // SINGLE VESTING
            const durationSeconds = BigInt(parseInt(vestingDays) * 24 * 60 * 60);
            const cliffSeconds = cliffDays ? BigInt(parseInt(cliffDays) * 24 * 60 * 60) : BigInt(0);
            
            const hash = await writeContractAsync({
                address: activeContract,
                abi: CONTRACT_ABI,
                functionName: 'createVesting',
                args: [tokenAddress as `0x${string}`, totalAmountWei, cliffSeconds, durationSeconds],
                value: parseEther("0.02"),
            });
            setTxHash(hash);
            setIsSuccessScreen(true);

        } else {
            // BATCH VESTING LOOP
            let lastHash: `0x${string}` | undefined;
            
            for (let i = 0; i < batchItems.length; i++) {
                setCurrentBatchIndex(i + 1); // Set Index BEFORE async call
                const item = batchItems[i];
                const amt = parseUnits(item.amount, finalDecimals);
                const dur = BigInt(parseInt(item.duration) * 24 * 60 * 60);
                const cliff = item.cliff ? BigInt(parseInt(item.cliff) * 24 * 60 * 60) : BigInt(0);

                lastHash = await writeContractAsync({
                    address: activeContract,
                    abi: CONTRACT_ABI,
                    functionName: 'createVesting',
                    args: [tokenAddress as `0x${string}`, amt, cliff, dur],
                    value: parseEther("0.02"),
                });
            }
            
            setTxHash(lastHash);
            setIsSuccessScreen(true);
        }
    } catch (e) {
        console.error(e);
        setActionType(null);
    } finally {
        setCurrentBatchIndex(0);
    }
  };

  const toggleInfo = (key: string) => {
    if (openInfo === key) setOpenInfo(null);
    else setOpenInfo(key);
  };

  if (isSuccessScreen) {
    return (
        <main className="min-h-screen bg-[#030305]">
            <Navbar />
            <div className="max-w-2xl mx-auto px-6 py-20 text-center">
                <div className="glass-card p-12 rounded-2xl flex flex-col items-center">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="text-green-500 w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-mono uppercase text-white mb-2">Protocol Secured</h2>
                    <p className="text-zinc-400 font-mono text-sm mb-8">
                        {isBatchMode ? "All vesting schedules submitted." : "Transaction submitted to the blockchain."}
                    </p>
                    {txHash && (
                        <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" className="btn-ghost mb-4 inline-block">View Last Transaction</a>
                    )}
                    <button onClick={() => window.location.reload()} className="text-zinc-500 hover:text-white text-xs font-mono uppercase mt-4">Create Another</button>
                </div>
            </div>
        </main>
    );
  }

  // Helper to determine button disabled state
  const isBusy = isWalletLoading || isTxConfirming || currentBatchIndex > 0;

  return (
    <main className="min-h-screen bg-[#030305]" onClick={() => setOpenInfo(null)}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center mb-8">
            <h1 className="text-3xl font-mono uppercase font-normal tracking-tight text-white mb-3 text-center">Initialize Protocol</h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,1)] animate-pulse"></div>
                <span className="text-blue-400 font-mono text-[10px] uppercase tracking-wider">Target: {chain?.name || "Not Connected"}</span>
            </div>
        </div>

        <div className="glass-card rounded-2xl p-1">
          <div className="grid grid-cols-2 gap-1 mb-8 bg-black/20 p-1 rounded-xl">
            {/* TABS ... (No Changes) */}
            <div className="relative">
                <button 
                    onClick={() => { setActiveTab('lock'); setIsBatchMode(false); }} 
                    className={`w-full py-3 rounded-lg font-mono text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'lock' ? 'bg-white/10 text-white border border-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Standard Lock
                    <Info size={12} className="text-zinc-500 hover:text-white transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('lock'); }}/>
                </button>
                {openInfo === 'lock' && (
                    <InfoPopup title="Standard Lock" description="Tokens are 100% locked until the specific date. Withdrawal is impossible before the unlock time." className="top-full left-0 mt-2" onClose={() => setOpenInfo(null)}/>
                )}
            </div>
            <div className="relative">
                <button 
                    onClick={() => setActiveTab('vesting')} 
                    className={`w-full py-3 rounded-lg font-mono text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'vesting' ? 'bg-white/10 text-white border border-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Linear Vesting
                    <Info size={12} className="text-zinc-500 hover:text-white transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('vesting'); }}/>
                </button>
                {openInfo === 'vesting' && (
                    <InfoPopup title="Linear Vesting" description="Tokens unlock gradually over time. You can claim unlocked tokens at any time." className="top-full right-0 mt-2" onClose={() => setOpenInfo(null)}/>
                )}
            </div>
          </div>

          <div className="px-8 pb-8 space-y-6">
             {/* INPUTS ... (No Changes) */}
             <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Token Address</label>
                <input type="text" placeholder="0x..." className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-purple-500/50 font-mono transition-colors placeholder:text-zinc-700" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
             </div>

             {/* STANDARD LOCK INPUTS */}
             {activeTab === 'lock' && (
               <>
                 <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Amount to Lock</label>
                    <input type="number" placeholder="0.00" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-purple-500/50 font-mono transition-colors placeholder:text-zinc-700" value={amount} onChange={(e) => setAmount(e.target.value)} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Unlock Date</label>
                    <div className="relative">
                        <input type="datetime-local" className={`w-full bg-[#0A0A0A] border rounded-lg p-4 text-white focus:outline-none font-mono transition-colors ${isTimeParadox ? 'border-red-500/50' : 'border-white/10 focus:border-purple-500/50'}`} value={unlockDate} onChange={(e) => setUnlockDate(e.target.value)} />
                        <Calendar className="absolute right-4 top-4 text-zinc-600 pointer-events-none" size={20} />
                    </div>
                 </div>
               </>
             )}

             {/* VESTING INPUTS */}
             {activeTab === 'vesting' && (
               <>
                 {/* Batch Toggle */}
                 <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-lg border border-white/5 relative">
                    <div className="flex items-center gap-2">
                        <Layers size={16} className={isBatchMode ? "text-purple-400" : "text-zinc-500"} />
                        <span className="text-xs font-mono uppercase tracking-widest text-zinc-300">Batch Mode</span>
                        <Info size={12} className="text-zinc-600 hover:text-white transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('batch'); }} />
                        {openInfo === 'batch' && <div className="absolute top-10 left-0 z-50"><InfoPopup title="Batch Mode" description="Create multiple vesting schedules in one session. Useful for distributing tokens to multiple team members." onClose={() => setOpenInfo(null)} /></div>}
                    </div>
                    <button onClick={() => setIsBatchMode(!isBatchMode)} className={`w-10 h-5 rounded-full transition-colors relative ${isBatchMode ? "bg-purple-500" : "bg-zinc-700"}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${isBatchMode ? "left-6" : "left-1"}`} /></button>
                 </div>

                 {!isBatchMode ? (
                    /* SINGLE VESTING */
                    <>
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Amount to Lock</label>
                            <input type="number" placeholder="0.00" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-purple-500/50 font-mono transition-colors placeholder:text-zinc-700" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center"><label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Vesting Duration</label></div>
                                <div className="relative">
                                    <input type="number" placeholder="e.g. 365" className={`w-full bg-[#0A0A0A] border rounded-lg p-4 text-white focus:outline-none font-mono transition-colors placeholder:text-zinc-700 ${isInvalidDuration ? 'border-red-500/50' : 'border-white/10 focus:border-purple-500/50'}`} value={vestingDays} onChange={(e) => setVestingDays(e.target.value)} />
                                    <Clock className="absolute right-4 top-4 text-zinc-600 pointer-events-none" size={20} />
                                </div>
                            </div>
                            <div className="space-y-2 relative">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1"><label className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Cliff Period</label><Info size={12} className="text-zinc-600 hover:text-white transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleInfo('cliff'); }} /></div>
                                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">(Optional)</span>
                                    {openInfo === 'cliff' && <div className="absolute top-6 left-0 z-50"><InfoPopup title="Cliff Period" description="A waiting period before vesting starts. No tokens unlock during the Cliff." onClose={() => setOpenInfo(null)} /></div>}
                                </div>
                                <div className="relative">
                                    <input type="number" placeholder="e.g. 30 days" className={`w-full bg-[#0A0A0A] border rounded-lg p-4 text-white focus:outline-none font-mono transition-colors placeholder:text-zinc-700 ${isInvalidCliff ? 'border-red-500/50' : 'border-white/10 focus:border-purple-500/50'}`} value={cliffDays} onChange={(e) => setCliffDays(e.target.value)} />
                                    <Hourglass className="absolute right-4 top-4 text-zinc-600 pointer-events-none" size={20} />
                                </div>
                            </div>
                        </div>
                    </>
                 ) : (
                    /* BATCH VESTING */
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase text-zinc-500 tracking-widest px-1">
                            <div className="col-span-5">Amount</div>
                            <div className="col-span-3">Duration</div>
                            <div className="col-span-3">Cliff</div>
                            <div className="col-span-1"></div>
                        </div>
                        {batchItems.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 animate-in fade-in slide-in-from-left-2">
                                <div className="col-span-5">
                                    <input type="number" placeholder="0.00" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono" value={item.amount} onChange={(e) => handleBatchChange(idx, 'amount', e.target.value)} />
                                </div>
                                <div className="col-span-3">
                                    <input type="number" placeholder="365" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono" value={item.duration} onChange={(e) => handleBatchChange(idx, 'duration', e.target.value)} />
                                </div>
                                <div className="col-span-3">
                                    <input type="number" placeholder="0" className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono" value={item.cliff} onChange={(e) => handleBatchChange(idx, 'cliff', e.target.value)} />
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                    {batchItems.length > 1 && <button onClick={() => removeBatchRow(idx)} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>}
                                </div>
                            </div>
                        ))}
                        <button onClick={addBatchRow} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-zinc-500 hover:text-white hover:border-white/40 transition-all flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest"><Plus size={14} /> Add Row</button>
                        <div className="flex justify-between items-center text-xs font-mono uppercase tracking-widest text-zinc-400 pt-2 px-1">
                            <span>Total Items: {batchItems.length}</span>
                            <span>Total Amount: {formatUnits(totalAmountWei, finalDecimals)}</span>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-[10px] text-purple-300 font-sans"><strong>Note:</strong> You will be asked to sign {batchItems.length} separate transactions. Each one costs 0.02 ETH.</div>
                    </div>
                 )}
               </>
             )}

             <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-3 mt-4">
                <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-yellow-500/80 font-sans leading-relaxed">
                    <strong className="text-yellow-500 font-mono uppercase">Caution:</strong> Do not lock "Rebasing" or "Elastic Supply" tokens. 
                    The contract logic supports standard tax tokens (Deflationary), but dynamic balance updates may cause funds to become permanently stuck.
                </div>
             </div>

             {/* FIXED ACTION BUTTONS WITH BATCH STATUS */}
             <div className="pt-4 space-y-3">
               <button 
                  onClick={handleApprove} 
                  disabled={!needsApproval || !isInputValid || isBusy} 
                  className={`w-full flex items-center justify-center gap-2 ${needsApproval ? 'btn-glow' : 'btn-ghost opacity-50 cursor-not-allowed'}`}
               >
                  {actionType === 'approve' && isBusy ? (
                      <><Loader2 className="animate-spin" size={16} />{isTxConfirming ? "Confirming..." : "Sign in Wallet..."}</>
                  ) : !needsApproval && isInputValid && totalAmountWei > 0 ? (
                      <><Check size={16} />1. Token Authorized</>
                  ) : ("1. Authorize Token")}
               </button>

               <button 
                  onClick={handleLock} 
                  disabled={needsApproval || !isInputValid || isBusy} 
                  className={`w-full flex items-center justify-center gap-2 ${!needsApproval && isInputValid ? 'btn-glow' : 'btn-ghost opacity-50 cursor-not-allowed'}`}
               >
                  {/* BATCH PROGRESS INDICATOR */}
                  {currentBatchIndex > 0 ? (
                       <><Loader2 className="animate-spin" size={16} /> Signing {currentBatchIndex}/{batchItems.length}...</>
                  ) : actionType === 'lock' && isBusy ? (
                       <><Loader2 className="animate-spin" size={16} />{isTxConfirming ? "Securing Protocol..." : "Sign in Wallet..."}</>
                  ) : (`2. Initialize ${activeTab === 'lock' ? 'Lock (0.05 ETH)' : isBatchMode ? `Batch (${(0.02 * batchItems.length).toFixed(2)} ETH)` : 'Vesting (0.02 ETH)'}`)}
               </button>

               {isTimeParadox && <p className="text-red-400 text-xs font-mono uppercase tracking-widest mt-3 text-center">Error: Time Paradox Detected</p>}
               {isInvalidDuration && <p className="text-red-400 text-xs font-mono uppercase tracking-widest mt-3 text-center">Error: Duration must be at least 1 day</p>}
               {isBatchInvalid && <p className="text-red-400 text-xs font-mono uppercase tracking-widest mt-3 text-center">Error: All rows must have valid data</p>}
               {writeError && <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20"><AlertCircle size={16} /><p className="text-xs font-mono uppercase tracking-wide">Transaction Failed: {writeError.message.split('.')[0]}</p></div>}
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}