// src/lib/contract.ts

// 1. DEPLOYMENT ADDRESS
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  84532: "0xb43d857561f530C73d249815631942954A50eD13", // Base sepolia
  8453: "0x1Ecf87D69c4a5c8D10ffb7D73e8ABB415043f866", // Base Mainnet
  42161: "0x8b2E21265E0D926C55E4514CA9Cc6fE8aA0873d6", // Arbitrum One
  10: "0x8b2E21265E0D926C55E4514CA9Cc6fE8aA0873d6", // Optimism Mainnet
};

// 2. V7 ABI (UPDATED FOR ENTERPRISE FEATURES)
export const CONTRACT_ABI = [
  // READ FUNCTIONS
  { type: "function", name: "getUserLocks", inputs: [{ name: "_user", type: "address" }], outputs: [{ type: "uint256[]" }],stateMutability: "view" },
  { type: "function", name: "getUserVestings", inputs: [{ name: "_user", type: "address" }], outputs: [{ type: "uint256[]" }],stateMutability: "view" },
  
  // LOCK STRUCT (V7)
  { type: "function", name: "locks", inputs: [{ name: "", type: "uint256" }], outputs: [
      { name: "id", type: "uint256" },
      { name: "token", type: "address" },
      { name: "decimals", type: "uint8" }, // V7: Cached Decimals
      { name: "owner", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "unlockTime", type: "uint256" },
      { name: "withdrawn", type: "bool" }
    ], stateMutability: "view" },

  // VESTING STRUCT (V7)
  { type: "function", name: "vestings", inputs: [{ name: "", type: "uint256" }], outputs: [
      { name: "id", type: "uint256" },
      { name: "token", type: "address" },
      { name: "decimals", type: "uint8" }, // V7: Cached Decimals
      { name: "owner", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "claimedAmount", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "cliffDuration", type: "uint256" }, // V7: Cliff Support
      { name: "duration", type: "uint256" }
    ], stateMutability: "view" },

  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "getCertificateHash", inputs: [{ name: "_lockId", type: "uint256" }], outputs: [{ type: "bytes32" }], stateMutability: "view" },

  // WRITE FUNCTIONS
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "lockToken", inputs: [{ name: "_token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_unlockTime", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "createVesting", inputs: [{ name: "_token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_cliffSeconds", type: "uint256" }, { name: "_durationSeconds", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "withdrawLock", inputs: [{ name: "_lockId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claimVesting", inputs: [{ name: "_vestingId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "extendLock", inputs: [{ name: "_lockId", type: "uint256" }, { name: "_newUnlockTime", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "transferLockOwnership", inputs: [{ name: "_lockId", type: "uint256" }, { name: "_newOwner", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "transferVestingOwnership", inputs: [{ name: "_vestingId", type: "uint256" }, { name: "_newOwner", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;