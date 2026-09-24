'use client';

import * as React from 'react';
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { baseSepolia, base, arbitrum, optimism, arbitrumSepolia, optimismSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TESTNETS_ENABLED } from '@/lib/contract';

// WalletConnect project ID comes from env only (Vercel + .env.local).
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Add it to .env.local (dev) or the Vercel project env (prod).');
}

const mainnets = [base, arbitrum, optimism] as const;
const testnets = [baseSepolia, arbitrumSepolia, optimismSepolia] as const;

const config = getDefaultConfig({
  appName: '0xKeep',
  projectId,
  chains: TESTNETS_ENABLED ? [...mainnets, ...testnets] : [...mainnets],
  transports: {
    // Mainnets — private Alchemy RPCs (no rate limiting)
    [base.id]:     http(process.env.NEXT_PUBLIC_RPC_BASE     || 'https://mainnet.base.org'),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http(process.env.NEXT_PUBLIC_RPC_OPTIMISM || 'https://mainnet.optimism.io'),
    // Testnets — only used when NEXT_PUBLIC_ENABLE_TESTNETS=true
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
