"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress, parseEventLogs, parseUnits } from "viem";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { FACTORY_ADDRESS, USDC, USDC_DECIMALS, factoryAbi } from "../lib/arc";

const PRESETS = [
  { label: "5 minutes (demo)", secs: 300 },
  { label: "1 day", secs: 86400 },
  { label: "1 week", secs: 604800 },
];

export function CreateCircle() {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [membersText, setMembersText] = useState("");
  const [amount, setAmount] = useState("10");
  const [secs, setSecs] = useState(300);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const notDeployed = FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    reset();
    const members = [...new Set(membersText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
    if (members.length < 2) return setError("Need at least 2 member addresses.");
    const bad = members.find((m) => !isAddress(m));
    if (bad) return setError(`Invalid address: ${bad}`);
    let contrib: bigint;
    try {
      contrib = parseUnits(amount, USDC_DECIMALS);
    } catch {
      return setError("Invalid contribution amount.");
    }
    if (contrib <= BigInt(0)) return setError("Contribution must be > 0.");
    if (!Number.isInteger(secs) || secs < 60) return setError("Round length must be ≥ 60 seconds.");
    writeContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: "createCircle",
      args: [USDC, contrib, BigInt(secs), members as `0x${string}`[], BigInt(500)],
    });
  }

  // After confirmation, resolve the new circle address from the receipt logs.
  async function resolveAndGo() {
    if (!hash || !publicClient) return;
    const receipt = await publicClient.getTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: factoryAbi, logs: receipt.logs });
    const ev = logs.find((l) => l.eventName === "CircleCreated");
    if (ev) {
      setCreated(ev.args.circle);
      router.push(`/circle/${ev.args.circle}`);
    }
  }
  if (isSuccess && hash && !created) void resolveAndGo();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border p-6">
      <h2 className="text-xl font-semibold">Start a circle</h2>
      {notDeployed && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
          Contracts are not deployed yet — connect back after the factory lands on Arc mainnet.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Members — one wallet address per line, payout order top to bottom
        <textarea
          rows={4}
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          placeholder={"0xabc…\n0xdef…"}
          className="rounded-lg border p-2 font-mono text-xs"
        />
      </label>
      {address && (
        <button
          type="button"
          onClick={() => setMembersText((t) => (t.includes(address) ? t : `${t}${t.trim() ? "\n" : ""}${address}`))}
          className="self-start text-sm text-zinc-600 underline"
        >
          + add my wallet ({address.slice(0, 6)}…{address.slice(-4)})
        </button>
      )}
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Contribution (USDC)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="rounded-lg border p-2 font-mono"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Round length
          <select
            value={secs}
            onChange={(e) => setSecs(Number(e.target.value))}
            className="rounded-lg border p-2"
          >
            {PRESETS.map((p) => (
              <option key={p.secs} value={p.secs}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Late payers add a 5% penalty that stays in the pot for future recipients. Payout order is fixed at
        creation — no randomness, no admin.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending || confirming || notDeployed || !address}
        className="rounded-full bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
      >
        {!address
          ? "Connect wallet first"
          : isPending
            ? "Confirm in wallet…"
            : confirming
              ? "Creating on Arc…"
              : "Create circle"}
      </button>
    </form>
  );
}
