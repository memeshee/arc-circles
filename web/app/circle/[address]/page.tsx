"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { Providers } from "../../../lib/wagmi";
import { ConnectButton } from "../../../components/ConnectButton";
import {
  EXPLORER,
  USDC,
  USDC_DECIMALS,
  arcMainnet,
  circleAbi,
  erc20Abi,
  fmtUSDC,
  shorten,
} from "../../../lib/arc";

function useNow(stepMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "closed — payout open";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${ss}s` : `${m}m ${ss}s`;
}

function CircleView({ addr }: { addr: `0x${string}` }) {
  const now = useNow();
  const { address: me } = useAccount();
  const publicClient = usePublicClient();
  const [cover, setCover] = useState("");
  const [feed, setFeed] = useState<string[]>([]);

  const q = { refetchInterval: 4000 } as const;
  const { data: contribution } = useReadContract({ address: addr, abi: circleAbi, functionName: "contribution", query: q });
  const { data: roundDuration } = useReadContract({ address: addr, abi: circleAbi, functionName: "roundDuration", query: q });
  const { data: currentRound } = useReadContract({ address: addr, abi: circleAbi, functionName: "currentRound", query: q });
  const { data: complete } = useReadContract({ address: addr, abi: circleAbi, functionName: "complete", query: q });
  const { data: memberCount } = useReadContract({ address: addr, abi: circleAbi, functionName: "memberCount", query: q });
  const { data: totalRounds } = useReadContract({ address: addr, abi: circleAbi, functionName: "totalRounds", query: q });
  const { data: recipient } = useReadContract({
    address: addr, abi: circleAbi, functionName: "recipientOf",
    args: currentRound !== undefined ? [currentRound] : undefined,
    query: { ...q, enabled: currentRound !== undefined && !complete },
  });
  const { data: deadline } = useReadContract({
    address: addr, abi: circleAbi, functionName: "roundDeadline",
    args: currentRound !== undefined ? [currentRound] : undefined,
    query: { ...q, enabled: currentRound !== undefined },
  });
  const { data: allPaid } = useReadContract({
    address: addr, abi: circleAbi, functionName: "roundFullyPaid",
    args: currentRound !== undefined ? [currentRound] : undefined,
    query: { ...q, enabled: currentRound !== undefined },
  });
  const { data: pot } = useReadContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [addr], query: q });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC, abi: erc20Abi, functionName: "allowance",
    args: me ? [me, addr] : undefined,
    query: { ...q, enabled: !!me },
  });

  const n = memberCount ? Number(memberCount) : 0;
  const { data: memberReads } = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: addr, abi: circleAbi, functionName: "members", args: [BigInt(i)],
    })),
    query: { enabled: n > 0 },
  });
  const members = (memberReads ?? []).flatMap((r) => (r.status === "success" ? [r.result as string] : []));
  const { data: paidReads, refetch: refetchPaid } = useReadContracts({
    contracts: members.map((m) => ({
      address: addr, abi: circleAbi, functionName: "paid",
      args: [currentRound ?? BigInt(0), m as `0x${string}`],
    })),
    query: { enabled: members.length > 0 && currentRound !== undefined },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const chainId = useChainId();
  const { chains, switchChainAsync } = useSwitchChain();
  const [netError, setNetError] = useState<string | null>(null);

  // Guard every write: force Arc first, never silently land on Ethereum.
  async function guardedWrite(args: Parameters<typeof writeContract>[0]) {
    setNetError(null);
    if (chainId !== arcMainnet.id) {
      const hasArc = chains.some((c) => c.id === arcMainnet.id);
      try {
        await switchChainAsync({ chainId: arcMainnet.id });
      } catch {
        setNetError(
          hasArc
            ? "Approve the switch to Arc in your wallet, then retry."
            : "Arc not in wallet — add Arc (chain 5042) manually, then retry."
        );
        return;
      }
    }
    writeContract({ ...args, chainId: arcMainnet.id } as typeof args);
  }
  const { isLoading: confirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (txSuccess) {
      void refetchAllowance();
      void refetchPaid();
    }
  }, [txSuccess]);

  // Activity feed from contract events (no subgraph on a day-old chain — read logs directly).
  useEffect(() => {
    if (!publicClient) return;
    (async () => {
      const [contribs, payouts] = await Promise.all([
        publicClient.getLogs({ address: addr, event: parseAbiItem("event Contributed(uint256 indexed round, address indexed member, address indexed payer, uint256 amount, uint256 penalty)"), fromBlock: BigInt(0) }),
        publicClient.getLogs({ address: addr, event: parseAbiItem("event PaidOut(uint256 indexed round, address indexed recipient, uint256 amount)"), fromBlock: BigInt(0) }),
      ]);
      const items = [
        ...contribs.map((l) => ({ bn: l.blockNumber, tx: `Round ${l.args.round}: ${shorten(l.args.member!)} paid${l.args.penalty! > BigInt(0) ? ` (late +${fmtUSDC(l.args.penalty!)} fee)` : ""}` })),
        ...payouts.map((l) => ({ bn: l.blockNumber, tx: `Round ${l.args.round}: ${fmtUSDC(l.args.amount!)} USDC → ${shorten(l.args.recipient!)}` })),
      ].sort((a, b) => (a.bn > b.bn ? -1 : 1));
      setFeed(items.map((i) => i.tx));
    })().catch(() => {});
  }, [publicClient, addr, currentRound]);

  const round = currentRound !== undefined ? Number(currentRound) : 0;
  const deadlineMs = deadline !== undefined ? Number(deadline) * 1000 : 0;
  const payoutOpen = !complete && (allPaid || (deadlineMs > 0 && now >= deadlineMs));
  const need = contribution !== undefined ? contribution + contribution / BigInt(20) : BigInt(0); // contribution + max 5% penalty
  const approved = allowance !== undefined && allowance >= need;

  return (
    <div className="flex flex-col gap-6">
      {netError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{netError}</p>}
      <div className="rounded-2xl border p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-lg">{shorten(addr)}</h2>
          <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:underline">
            explorer ↗
          </a>
        </div>
        {complete ? (
          <p className="mt-2 font-semibold text-green-600">Circle complete — every member has been paid.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>Round <b>{round + 1}</b> / {totalRounds?.toString() ?? "…"}</span>
            <span>Each pays <b>{contribution !== undefined ? fmtUSDC(contribution) : "…"} USDC</b></span>
            <span>In pot <b>{pot !== undefined ? fmtUSDC(pot) : "…"} USDC</b></span>
            <span>⏳ {fmtCountdown(deadlineMs - now)}</span>
          </div>
        )}
        {!complete && recipient && (
          <p className="mt-1 text-sm">This round pays <span className="font-mono">{shorten(recipient)}</span></p>
        )}
      </div>

      {!complete && (
        <div className="flex flex-wrap gap-3">
          {!approved ? (
            <button
              disabled={isPending || confirming || !me || contribution === undefined}
              onClick={() => guardedWrite({ address: USDC, abi: erc20Abi, functionName: "approve", args: [addr, need] })}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
            >
              {confirming ? "Confirming…" : `1/2 Approve USDC`}
            </button>
          ) : (
            <button
              disabled={isPending || confirming || !me}
              onClick={() => guardedWrite({ address: addr, abi: circleAbi, functionName: "contribute" })}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
            >
              {confirming ? "Confirming…" : `2/2 Pay ${contribution !== undefined ? formatUnits(contribution, USDC_DECIMALS) : ""} USDC`}
            </button>
          )}
          <button
            disabled={isPending || confirming || !payoutOpen}
            onClick={() => guardedWrite({ address: addr, abi: circleAbi, functionName: "payout" })}
            title={!payoutOpen ? "Opens when everyone paid or the deadline passes" : "Send the pot to this round's recipient"}
            className="rounded-full border px-5 py-2 text-sm font-medium disabled:opacity-40"
          >
            {confirming ? "Confirming…" : "Trigger payout"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border p-6">
        <h3 className="mb-3 font-semibold">Members — round {round + 1}</h3>
        <ul className="flex flex-col gap-2 text-sm">
          {members.map((m, i) => {
            const p = paidReads?.[i]?.status === "success" ? (paidReads[i].result as boolean) : undefined;
            const isRecip = !complete && recipient?.toLowerCase() === m.toLowerCase();
            return (
              <li key={m} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                <span className="font-mono">
                  {i + 1}. {shorten(m)} {isRecip && <span title="receives this round's pot">🎯</span>}
                </span>
                <span>{p === undefined ? "…" : p ? "✅ paid" : "⏳ pending"}</span>
              </li>
            );
          })}
        </ul>
        {!complete && (
          <div className="mt-3 flex gap-2">
            <input
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="Cover for a member: 0x…"
              className="flex-1 rounded-lg border p-2 font-mono text-xs"
            />
            <button
              disabled={isPending || confirming || !cover}
              onClick={() => guardedWrite({ address: addr, abi: circleAbi, functionName: "contributeFor", args: [cover as `0x${string}`] })}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              Cover them
            </button>
          </div>
        )}
      </div>

      {feed.length > 0 && (
        <div className="rounded-2xl border p-6">
          <h3 className="mb-3 font-semibold">Activity</h3>
          <ul className="flex flex-col gap-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            {feed.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CirclePage() {
  const params = useParams();
  const addr = params.address as `0x${string}`;
  return (
    <Providers>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">← all circles</Link>
          <ConnectButton />
        </header>
        <main>
          <CircleView addr={addr} />
        </main>
      </div>
    </Providers>
  );
}
