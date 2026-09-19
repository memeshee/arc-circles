"use client";

import { useEffect } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arcMainnet } from "../lib/arc";
import { shorten } from "../lib/arc";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongNet = isConnected && chainId !== arcMainnet.id;

  // Auto-switch to Arc as soon as the wallet connects on the wrong chain.
  useEffect(() => {
    if (wrongNet && !switching) switchChain({ chainId: arcMainnet.id });
  }, [wrongNet, switching, switchChain]);

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0], chainId: arcMainnet.id })}
        disabled={isPending}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  if (chainId !== arcMainnet.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: arcMainnet.id })}
        disabled={switching}
        className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-500"
      >
        {switching ? "Switching to Arc…" : "Switch to Arc"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border px-4 py-2 font-mono text-sm">{shorten(address!)}</span>
      <button onClick={() => disconnect()} className="text-sm text-zinc-500 hover:text-zinc-800">
        Disconnect
      </button>
    </div>
  );
}
