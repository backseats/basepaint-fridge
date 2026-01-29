'use client';

import { createConfig, http, WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

const config = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors: [farcasterFrame()],
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
