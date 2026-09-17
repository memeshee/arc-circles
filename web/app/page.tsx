"use client";

import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { Providers } from "../lib/wagmi";
import { ConnectButton } from "../components/ConnectButton";
import { CreateCircle } from "../components/CreateCircle";
import { EXPLORER, FACTORY_ADDRESS, factoryAbi, shorten } from "../lib/arc";

function CircleList() {
  const { data: count } = useReadContract({
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
  if (!n) return <p className="text-sm text-zinc-500">No circles yet — start the first one above.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {data?.map((r, i) =>
        r.status === "success" ? (
          <li key={idx[i]} className="flex items-center justify-between rounded-lg border px-4 py-2 font-mono text-sm">
            <Link href={`/circle/${r.result}`} className="hover:underline">
              {shorten(r.result as unknown as string)}
            </Link>
            <a
              href={`${EXPLORER}/address/${r.result}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-500 hover:underline"
            >
              explorer ↗
            </a>
          </li>
        ) : null,
      )}
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
