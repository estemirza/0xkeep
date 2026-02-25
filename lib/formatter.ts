// Chain Prefix Mapping
const CHAIN_PREFIXES: Record<number, string> = {
  8453: "B",   // Base
  42161: "A",  // Arbitrum
  10: "OP",    // Optimism
  84532: "BS", // Base Sepolia (Testnet)
};

// Reverse Mapping (Prefix -> ChainID)
const PREFIX_TO_CHAIN: Record<string, number> = {
  "B": 8453,
  "A": 42161,
  "OP": 10,
  "BS": 84532
};

// --- FORMATTERS (Blockchain -> UI) ---
export function formatLockId(rawId: bigint | string | number, chainId: number): string {
  const prefix = CHAIN_PREFIXES[chainId] || "UNK"; // UNK = Unknown
  return `0xK-${prefix}-1${rawId.toString()}1`;
}

export function formatVestingId(rawId: bigint | string | number, chainId: number): string {
  const prefix = CHAIN_PREFIXES[chainId] || "UNK";
  return `0xK-${prefix}-2${rawId.toString()}2`;
}

// --- PARSER (UI -> Blockchain + ChainID) ---
export function parseId(prettyId: string): { rawId: bigint, chainId: number } {
  // Format: 0xK-[PREFIX]-[TYPE][ID][TYPE]
  // Example: 0xK-BS-101
  
  const parts = prettyId.split('-');
  if (parts.length !== 3 || parts[0] !== '0xK') {
    throw new Error("Invalid ID Format");
  }

  const prefix = parts[1]; // "BS", "B", "A"
  const numericPart = parts[2]; // "101"

  const chainId = PREFIX_TO_CHAIN[prefix];
  if (!chainId) throw new Error("Unknown Chain Prefix");

  // Remove the wrapper numbers (first and last char)
  // "101" -> "0"
  const rawString = numericPart.slice(1, -1);
  
  return { 
    rawId: BigInt(rawString), 
    chainId 
  };
}