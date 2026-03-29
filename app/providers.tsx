'use client';

import * as React from 'react';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { baseSepolia, base, arbitrum, optimism, arbitrumSepolia, optimismSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: '0xKeep',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'f8faee28443487e40c6db484720d0de1',
  chains: [base, arbitrum, optimism, baseSepolia, arbitrumSepolia, optimismSepolia],
  transports: {
    // Mainnets — private Alchemy RPCs (no rate limiting)
    [base.id]:     http(process.env.NEXT_PUBLIC_RPC_BASE     || 'https://mainnet.base.org'),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http(process.env.NEXT_PUBLIC_RPC_OPTIMISM || 'https://mainnet.optimism.io'),
    // Testnets — public RPCs are fine, low traffic
    [baseSepolia.id]:     http(),
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7C3AED',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
          coolMode
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}