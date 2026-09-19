"use client";

import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { Providers } from "../lib/wagmi";
import { ConnectButton } from "../components/ConnectButton";
import { CreateCircle } from "../components/CreateCircle";
import { EXPLORER, FACTORY_ADDRESS, USDC, circleAbi, erc20Abi, factoryAbi, fmtUSDC, shorten } from "../lib/arc";

function CircleRow({ addr }: { addr: `0x${string}` }) {
  const q = { refetchInterval: 8000 } as const;
  const { data: contribution } = useReadContract({ address: addr, abi: circleAbi, functionName: "contribution", query: q });
  const { data: round } = useReadContract({ address: addr, abi: circleAbi, functionName: "currentRound", query: q });
  const { data: total } = useReadContract({ address: addr, abi: circleAbi, functionName: "totalRounds", query: q });
  const { data: done } = useReadContract({ address: addr, abi: circleAbi, functionName: "complete", query: q });
  const { data: members } = useReadContract({ address: addr, abi: circleAbi, functionName: "memberCount", query: q });
  const { data: pot } = useReadContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [addr], query: q });

  const r = round !== undefined ? Number(round) : null;
  const t = total !== undefined ? Number(total) : null;
  const status = done ? "Complete" : r !== null && t !== null ? `Round ${r + 1}/${t}` : "…";
  const detail =
    contribution !== undefined && members !== undefined && pot !== undefined
      ? `${fmtUSDC(contribution)} USDC × ${members.toString()} members · pot ${fmtUSDC(pot)} USDC`
      : "loading…";

  return (
    <li className="flex flex-col gap-1 rounded-lg border px-4 py-2">
      <div className="flex items-center justify-between font-mono text-sm">
        <Link href={`/circle/${addr}`} className="hover:underline">
          {shorten(addr)}
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            done ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
          }`}
        >
          {status}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="font-mono">{detail}</span>
        <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer" className="hover:underline">
          explorer ↗
        </a>
      </div>
    </li>
  );
}

function CircleList() {
  const { data: count, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "circleCount",
    query: { refetchInterval: 5000 },
  });
  const n = count ? Number(count) : 0;
  const idx = Array.from({ length: Math.min(n, 12) }, (_, i) => n - 1 - i);
  const { data } = useReadContracts({
    contracts: idx.map((i) => ({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: "allCircles",
      args: [BigInt(i)],
    })),
    query: { enabled: idx.length > 0 },
  });
  if (isLoading || count === undefined)
    return (
      <ul className="flex flex-col gap-2" aria-label="Loading circles">
        {[0, 1].map((i) => (
          <li key={i} className="animate-pulse rounded-lg border px-4 py-2">
            <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
          </li>
        ))}
      </ul>
    );
  if (!n) return <p className="text-sm text-zinc-500">No circles yet — start the first one above.</p>;
  const addrs = (data ?? []).flatMap((r) => (r.status === "success" ? [r.result as unknown as `0x${string}`] : []));
  if (!addrs.length)
    return <p className="text-sm text-zinc-500">Couldn’t load circles — check your connection, then retry.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {addrs.map((a) => (
        <CircleRow key={a} addr={a} />
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <Providers>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Circles</h1>
            <p className="text-sm text-zinc-500">Rotating savings on Arc — paid in USDC, settled in seconds.</p>
          </div>
          <ConnectButton />
        </header>
        <main className="flex flex-col gap-8">
          <CreateCircle />
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Recent circles</h2>
            <CircleList />
          </section>
          <footer className="text-xs text-zinc-500">
            Each circle is its own contract: fixed members, fixed payout order, 5% late penalty shared with
            future recipients.{" "}
            <a className="underline" href={`${EXPLORER}/address/${FACTORY_ADDRESS}`} target="_blank" rel="noreferrer">
              Factory on explorer
            </a>
          </footer>
        </main>
      </div>
    </Providers>
  );
}
