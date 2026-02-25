'use client';

import { useQuery } from "@tanstack/react-query";

// Map Wagmi Chain IDs to DefiLlama Chain Names
const CHAIN_MAP: Record<number, string> = {
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  // Testnets usually don't have prices on DefiLlama, but we map them just in case
  84532: "base", 
};

export function useTokenPrice(chainId: number | undefined, tokenAddress: string | undefined) {
  return useQuery({
    queryKey: ['tokenPrice', chainId, tokenAddress],
    queryFn: async () => {
      if (!chainId || !tokenAddress || !CHAIN_MAP[chainId]) return 0;

      const chainName = CHAIN_MAP[chainId];
      const url = `https://coins.llama.fi/prices/current/${chainName}:${tokenAddress}`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        // DefiLlama returns: { "coins": { "base:0x...": { "price": 1.23 } } }
        const key = `${chainName}:${tokenAddress}`;
        return data.coins[key]?.price || 0;
      } catch (error) {
        console.error("Failed to fetch price", error);
        return 0;
      }
    },
    // Only run if we have valid inputs
    enabled: !!chainId && !!tokenAddress,
    // Cache for 5 minutes to save bandwidth
    staleTime: 1000 * 60 * 5, 
  });
}