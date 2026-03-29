'use client';

import { useQuery } from "@tanstack/react-query";

// Map chain IDs to DefiLlama chain names
const CHAIN_MAP: Record<number, string> = {
  8453:    "base",
  42161:   "arbitrum",
  10:      "optimism",
  // Testnets — tokens won't have real prices, returns 0 gracefully
  84532:   "base",
  421614:  "arbitrum",
  11155420:"optimism",
};

export function useTokenPrice(
  chainId: number | undefined,
  tokenAddress: string | undefined
) {
  return useQuery({
    queryKey: ['tokenPrice', chainId, tokenAddress],
    queryFn: async () => {
      if (!chainId || !tokenAddress || !CHAIN_MAP[chainId]) return 0;

      const chainName = CHAIN_MAP[chainId];
      const url = `https://coins.llama.fi/prices/current/${chainName}:${tokenAddress}`;

      try {
        const res = await fetch(url);

        // FIX H8: Check response status before parsing
        // A 429 (rate limit) or 500 (server error) would otherwise
        // throw a confusing error when we try to read data.coins
        if (!res.ok) return 0;

        const data = await res.json();
        const key = `${chainName}:${tokenAddress}`;
        return data.coins?.[key]?.price ?? 0;
      } catch {
        return 0;
      }
    },
    enabled: !!chainId && !!tokenAddress,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,                  // Only retry once on failure
  });
}