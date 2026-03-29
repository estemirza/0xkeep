// src/lib/contract.ts

// ─────────────────────────────────────────────
// CONTRACT ADDRESSES — V12 Deployment
// ─────────────────────────────────────────────
export const CONTRACT_ADDRESSES: Record<number, `0x${string}`> = {
  // Testnets
  84532:   "0x22049F0686ff6F17d1175f0f74dF8C67F7ce50ea", // Base Sepolia
  421614:  "0xA2e1496692B41DD69291138933A9800e049c5221", // Arbitrum Sepolia
  11155420:"0xA2e1496692B41DD69291138933A9800e049c5221", // Optimism Sepolia

  // Mainnets
  8453:  "0x49bF4Ded143402B2fD89d8d284e477Dfdc9fa02B", // Base Mainnet
  42161: "0xDC9bFb15C28486590Cbf58F3FEA9ADbEB9B0334c", // Arbitrum One
  10:    "0x1Ecf87D69c4a5c8D10ffb7D73e8ABB415043f866", // Optimism Mainnet
};

// ─────────────────────────────────────────────
// LOCKER ABI — V12
// ─────────────────────────────────────────────
export const CONTRACT_ABI = [
  // ── CONFIG (read fees directly from contract — never hardcode) ──
  {
    type: "function", name: "LOCK_FEE",
    inputs: [], outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "VESTING_FEE",
    inputs: [], outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "CHAIN_ID",
    inputs: [], outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },

  // ── COUNTERS ──
  {
    type: "function", name: "allLocksCount",
    inputs: [], outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "allVestingsCount",
    inputs: [], outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },

  // ── USER ARRAYS ──
  {
    type: "function", name: "getUserLocks",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "getUserVestings",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "getUserLocksLength",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "getUserVestingsLength",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },

  // ── LOCK STRUCT (V12 packed layout) ──
  {
    type: "function", name: "locks",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "token",      type: "address" }, // [0]
      { name: "amount",     type: "uint96"  }, // [1]
      { name: "owner",      type: "address" }, // [2]
      { name: "decimals",   type: "uint8"   }, // [3]
      { name: "withdrawn",  type: "bool"    }, // [4]
      { name: "unlockTime", type: "uint32"  }, // [5]
      { name: "id",         type: "uint256" }, // [6]
    ],
    stateMutability: "view"
  },

  // ── VESTING STRUCT (V12 packed layout) ──
  {
    type: "function", name: "vestings",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "token",         type: "address" }, // [0]
      { name: "totalAmount",   type: "uint96"  }, // [1]
      { name: "owner",         type: "address" }, // [2]
      { name: "decimals",      type: "uint8"   }, // [3]
      { name: "claimedAmount", type: "uint96"  }, // [4]
      { name: "startTime",     type: "uint32"  }, // [5]
      { name: "cliffDuration", type: "uint32"  }, // [6]
      { name: "duration",      type: "uint32"  }, // [7]
      { name: "id",            type: "uint256" }, // [8]
    ],
    stateMutability: "view"
  },

  // ── CERTIFICATE HASHES ──
  {
    type: "function", name: "getCertificateHash",
    inputs: [{ name: "_lockId", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "getVestingCertificateHash",
    inputs: [{ name: "_vestingId", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view"
  },

  // ── WRITE — LOCK ──
  {
    type: "function", name: "lockToken",
    inputs: [
      { name: "_token",      type: "address" },
      { name: "_amount",     type: "uint256" },
      { name: "_unlockTime", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function", name: "withdrawLock",
    inputs: [{ name: "_lockId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "extendLock",
    inputs: [
      { name: "_lockId",       type: "uint256" },
      { name: "_newUnlockTime", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "transferLockOwnership",
    inputs: [
      { name: "_lockId",   type: "uint256" },
      { name: "_newOwner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },

  // ── WRITE — VESTING ──
  {
    type: "function", name: "createVesting",
    inputs: [
      { name: "_token",           type: "address" },
      { name: "_amount",          type: "uint256" },
      { name: "_cliffSeconds",    type: "uint256" },
      { name: "_durationSeconds", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function", name: "claimVesting",
    inputs: [{ name: "_vestingId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "transferVestingOwnership",
    inputs: [
      { name: "_vestingId", type: "uint256" },
      { name: "_newOwner",  type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },

  // ── EVENTS (needed for parsing lockId from tx receipt) ──
  {
    type: "event", name: "Locked",
    inputs: [
      { name: "lockId",     type: "uint256", indexed: true  },
      { name: "token",      type: "address", indexed: true  },
      { name: "owner",      type: "address", indexed: true  },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "unlockTime", type: "uint256", indexed: false },
      { name: "chainId",    type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "VestingCreated",
    inputs: [
      { name: "vestingId", type: "uint256", indexed: true  },
      { name: "token",     type: "address", indexed: true  },
      { name: "owner",     type: "address", indexed: true  },
      { name: "amount",    type: "uint256", indexed: false },
      { name: "cliff",     type: "uint256", indexed: false },
      { name: "duration",  type: "uint256", indexed: false },
      { name: "chainId",   type: "uint256", indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────
// TOKEN ABI — separated from locker ABI
// Use this when calling approve/allowance/etc
// on the token contract, NOT the locker.
// ─────────────────────────────────────────────
export const TOKEN_ABI = [
  {
    type: "function", name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "allowance",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view"
  },
] as const;