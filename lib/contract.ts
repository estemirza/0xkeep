// src/lib/contract.ts

// 1. DEPLOYMENT ADDRESS
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  84532: "0x48DBD53ec8dD4ffc1A8fdD38afD62462B28b034f", // Base sepolia
  8453: "0xDC9bFb15C28486590Cbf58F3FEA9ADbEB9B0334c", // Base Mainnet
  42161: "0x63ce2Bd3eA659C3dd1948a98A9e188feC53D7B88", // Arbitrum One
  10: "0x63ce2Bd3eA659C3dd1948a98A9e188feC53D7B88", // Optimism Mainnet
};

// 2. V7 ABI (UPDATED FOR ENTERPRISE FEATURES)
export const CONTRACT_ABI = [
  // READ
  { type: "function", name: "getUserLocks", inputs: [{ name: "_user", type: "address" }], outputs: [{ type: "uint256[]" }],stateMutability: "view" },
  { type: "function", name: "getUserVestings", inputs: [{ name: "_user", type: "address" }], outputs: [{ type: "uint256[]" }],stateMutability: "view" },
  
  // V11 STRUCT ORDER (PACKED)
  { type: "function", name: "locks", inputs: [{ name: "", type: "uint256" }], outputs: [
      { name: "token", type: "address" },      // Index 0
      { name: "amount", type: "uint96" },      // Index 1
      { name: "owner", type: "address" },      // Index 2
      { name: "decimals", type: "uint8" },     // Index 3
      { name: "withdrawn", type: "bool" },     // Index 4
      { name: "unlockTime", type: "uint32" },  // Index 5
      { name: "id", type: "uint256" }          // Index 6
    ], stateMutability: "view" },

  { type: "function", name: "vestings", inputs: [{ name: "", type: "uint256" }], outputs: [
      { name: "token", type: "address" },      // Index 0
      { name: "totalAmount", type: "uint96" }, // Index 1
      { name: "owner", type: "address" },      // Index 2
      { name: "decimals", type: "uint8" },     // Index 3
      { name: "claimedAmount", type: "uint96" },// Index 4
      { name: "startTime", type: "uint32" },   // Index 5
      { name: "cliffDuration", type: "uint32" },// Index 6
      { name: "duration", type: "uint32" },    // Index 7
      { name: "id", type: "uint256" }          // Index 8
    ], stateMutability: "view" },

  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "getCertificateHash", inputs: [{ name: "_lockId", type: "uint256" }], outputs: [{ type: "bytes32" }], stateMutability: "view" },

  // WRITE
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "lockToken", inputs: [{ name: "_token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_unlockTime", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "createVesting", inputs: [{ name: "_token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_cliffSeconds", type: "uint256" }, { name: "_durationSeconds", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "withdrawLock", inputs: [{ name: "_lockId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claimVesting", inputs: [{ name: "_vestingId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "extendLock", inputs: [{ name: "_lockId", type: "uint256" }, { name: "_newUnlockTime", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "transferLockOwnership", inputs: [{ name: "_lockId", type: "uint256" }, { name: "_newOwner", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "transferVestingOwnership", inputs: [{ name: "_vestingId", type: "uint256" }, { name: "_newOwner", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;