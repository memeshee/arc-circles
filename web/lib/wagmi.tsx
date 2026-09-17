"use client";

import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { arcMainnet } from "./arc";

const config = createConfig({
  chains: [arcMainnet],
  connectors: [injected()],
  transports: { [arcMainnet.id]: http("https://rpc.mainnet.arc.io") },
});

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
