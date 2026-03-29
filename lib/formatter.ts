// src/lib/formatter.ts

// ─────────────────────────────────────────────
// CHAIN + TYPE PREFIX MAPPING
// Format: 0xK-{CHAIN}{TYPE}-{rawId}
// CHAIN: B=Base, A=Arbitrum, O=Optimism, BS=BaseSepolia, AS=ArbitrumSepolia, OS=OptimismSepolia
// TYPE:  L=Lock, V=Vesting
// Example: lock #6 on Base       → 0xK-BL-6
// Example: vesting #3 on Arbitrum → 0xK-AV-3
// ─────────────────────────────────────────────

const CHAIN_CODE: Record<number, string> = {
  8453:    "B",   // Base Mainnet
  42161:   "A",   // Arbitrum One
  10:      "O",   // Optimism Mainnet
  84532:   "BS",  // Base Sepolia
  421614:  "AS",  // Arbitrum Sepolia
  11155420:"OS",  // Optimism Sepolia
};

const CHAIN_CODE_TO_ID: Record<string, number> = {
  "B":  8453,
  "A":  42161,
  "O":  10,
  "BS": 84532,
  "AS": 421614,
  "OS": 11155420,
};

// ─────────────────────────────────────────────
// FORMATTERS — blockchain ID → readable URL slug
// ─────────────────────────────────────────────

export function formatLockId(
  rawId: bigint | string | number,
  chainId: number
): string {
  const chain = CHAIN_CODE[chainId] || "UNK";
  return `0xK-${chain}L-${rawId.toString()}`;
}

export function formatVestingId(
  rawId: bigint | string | number,
  chainId: number
): string {
  const chain = CHAIN_CODE[chainId] || "UNK";
  return `0xK-${chain}V-${rawId.toString()}`;
}

// ─────────────────────────────────────────────
// PARSER — URL slug → blockchain ID + chain + type
// ─────────────────────────────────────────────

export type ParsedId = {
  rawId: bigint;
  chainId: number;
  type: "lock" | "vesting";
};

export function parseId(prettyId: string): ParsedId {
  if (!prettyId || typeof prettyId !== "string") {
    throw new Error("Invalid ID: empty or wrong type");
  }

  // Expected format: 0xK-{CHAIN}{TYPE}-{rawId}
  // Examples: 0xK-BL-6, 0xK-BSV-3, 0xK-AS-12
  const parts = prettyId.split("-");

  if (parts.length < 3 || parts[0] !== "0xK") {
    throw new Error(`Invalid ID format: ${prettyId}`);
  }

  // Reconstruct middle section in case chain code contains a dash (it doesn't,
  // but this makes the parser robust if rawId ever contains one)
  const middlePart = parts[1];           // e.g. "BL", "BSV", "ASL"
  const rawIdStr   = parts.slice(2).join("-"); // e.g. "6", "12"

  // Last character of middlePart is the type: L or V
  const typeChar  = middlePart.slice(-1);   // "L" or "V"
  const chainCode = middlePart.slice(0, -1); // "B", "BS", "A", "AS", "O", "OS"

  // Validate type
  if (typeChar !== "L" && typeChar !== "V") {
    throw new Error(`Unknown type character: ${typeChar} in ${prettyId}`);
  }

  // Validate chain
  const chainId = CHAIN_CODE_TO_ID[chainCode];
  if (!chainId) {
    throw new Error(`Unknown chain code: ${chainCode} in ${prettyId}`);
  }

  // Validate rawId — must be a non-negative integer string
  if (!/^\d+$/.test(rawIdStr)) {
    throw new Error(`Invalid raw ID: ${rawIdStr} in ${prettyId}`);
  }

  return {
    rawId:   BigInt(rawIdStr),
    chainId: chainId,
    type:    typeChar === "L" ? "lock" : "vesting",
  };
}

// ─────────────────────────────────────────────
// EXPLORER URL HELPERS — used by certificate pages
// ─────────────────────────────────────────────

export function getExplorerAddressLink(
  chainId: number,
  address: string
): string {
  switch (chainId) {
    case 8453:    return `https://basescan.org/address/${address}`;
    case 42161:   return `https://arbiscan.io/address/${address}`;
    case 10:      return `https://optimistic.etherscan.io/address/${address}`;
    case 84532:   return `https://sepolia.basescan.org/address/${address}`;
    case 421614:  return `https://sepolia.arbiscan.io/address/${address}`;
    case 11155420:return `https://sepolia-optimism.etherscan.io/address/${address}`;
    default:      return `https://sepolia.basescan.org/address/${address}`;
  }
}

export function getExplorerTokenLink(
  chainId: number,
  address: string
): string {
  switch (chainId) {
    case 8453:    return `https://basescan.org/token/${address}`;
    case 42161:   return `https://arbiscan.io/token/${address}`;
    case 10:      return `https://optimistic.etherscan.io/token/${address}`;
    case 84532:   return `https://sepolia.basescan.org/token/${address}`;
    case 421614:  return `https://sepolia.arbiscan.io/token/${address}`;
    case 11155420:return `https://sepolia-optimism.etherscan.io/token/${address}`;
    default:      return `https://sepolia.basescan.org/token/${address}`;
  }
}

export function getExplorerTxLink(
  chainId: number,
  hash: string
): string {
  switch (chainId) {
    case 8453:    return `https://basescan.org/tx/${hash}`;
    case 42161:   return `https://arbiscan.io/tx/${hash}`;
    case 10:      return `https://optimistic.etherscan.io/tx/${hash}`;
    case 84532:   return `https://sepolia.basescan.org/tx/${hash}`;
    case 421614:  return `https://sepolia.arbiscan.io/tx/${hash}`;
    case 11155420:return `https://sepolia-optimism.etherscan.io/tx/${hash}`;
    default:      return `https://sepolia.basescan.org/tx/${hash}`;
  }
}

// ─────────────────────────────────────────────
// CHAIN DISPLAY HELPERS — used by network badges
// ─────────────────────────────────────────────

export const CHAIN_NAMES: Record<number, string> = {
  8453:    "BASE",
  42161:   "ARBITRUM",
  10:      "OPTIMISM",
  84532:   "BASE SEPOLIA",
  421614:  "ARB SEPOLIA",
  11155420:"OP SEPOLIA",
};

export const CHAIN_COLORS: Record<number, string> = {
  8453:    "bg-blue-500",
  42161:   "bg-blue-400",
  10:      "bg-red-500",
  84532:   "bg-blue-600",
  421614:  "bg-blue-300",
  11155420:"bg-red-400",
};