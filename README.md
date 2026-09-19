# Circles — Rotating Savings on Arc

Onchain rotating savings circles (ROSCA) settled in **native USDC on [Arc](https://arc.network)** (chain 5042). Fixed members, fixed payout order, late fees shared with the group — a savings habit for people the banking system prices out, running on rails where a $2 weekly contribution isn't eaten by fees.

**Live:** https://arc-circles.vercel.app · **Contracts (Arc mainnet):** factory [`0x6792E51FBD24f9315282BD5b6c5E713dCc779C69`](https://explorer.arc.io/address/0x6792E51FBD24f9315282BD5b6c5E713dCc779C69) · **Track:** Arc Microgrants (DoraHacks, deadline Oct 14 23:59 ET)

---

## What

A **ROSCA (rotating savings and credit association)** — one of the oldest financial instruments on earth. A group of N people each contributes a fixed amount every round; each round one member takes the whole pot. No interest, no lender, no collateral — the social bond *is* the collateral. An estimated [2.5B+ people](https://en.wikipedia.org/wiki/Rotating_savings_and_credit_association) save this way (tandas, arisan, chit funds, susus).

Circles moves that ceremony onchain with two trust upgrades over the informal version:

1. **Escrowed pot** — contributions lock in the contract; the organizer can't run with the money.
2. **Late-fee sharing** — pay after the deadline and a 5% penalty stays in the pot, so punctual members *earn* from late ones instead of just resenting them.

Core mechanics (`src/SavingsCircle.sol`):

- `createCircle(token, contribution, roundDuration, members, penaltyBps)` → deploys a circle via `CircleFactory`, payout order = member order.
- `contribute()` / `contributeFor(member)` → pay your share, or cover someone else's (mirrors how real circles work — a cousin covers you, you settle later).
- `payout()` → permissionless; fires when everyone paid **or** the deadline passes. Recipient must be paid up through this round (covered payments count).
- `setYieldAdapter` / `moveToYield` → phase-2 hook for yield (see Roadmap). Zero address today = 1:1 holding, no mock yield ever reported.

## Why Arc — and why this can't live anywhere else

| Arc property | What it unlocks for Circles |
|---|---|
| **Native USDC as gas** (18-decimal native view, same asset) | One balance to understand. A saver holds USDC; contributions, fees, and gas all come from it. No "you need ETH for gas" onboarding cliff. |
| **Sub-cent, <1s finality fees** | A $2/week circle is viable. On mainnet L1 the gas would exceed the savings; on Arc the round-trip costs fractions of a cent. |
| **EVM + 6-decimal USDC (`0x3600…0000`)** | Standard tooling (viem/wagmi/Foundry) with money that behaves like money. |
| **USYC path (Circle Mint, allowlisted)** | Phase-2: idle pots earn treasury-bill yield without leaving the Circle trust perimeter — the pitch for the follow-on Circle Grant Program. |

A ROSCA is pure coordination + tiny transfers — exactly the workload a stablecoin chain exists for, and exactly the workload legacy rails overcharge.

## How it works

```
Round r (each `roundDuration` seconds)
  1. Every member calls contribute()  ── USDC → circle (late = +5% stays in pot)
     (anyone may contributeFor() an absent member)
  2. Anyone calls payout() once all paid OR deadline passes
     → whole pot → members[r]  (round advances, or circle completes)
```

**Walkthrough (3 members, 10 USDC/round):** Alice, Bob, Cara each approve 10.5 USDC (contribution + max penalty). Round 0: all three pay → anyone triggers payout → 30 USDC → Alice. Round 1 → Bob. Round 2 → Cara, circle completes. If Bob pays late in round 1, his 0.5 penalty stays in the pot — Alice already got hers, Cara's round is fatter.

**Try it live:**

1. Add Arc to your wallet: chain ID **5042**, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`. Fund with USDC on Arc ([bridge](https://bridge.circle.com)).
2. Open https://arc-circles.vercel.app, connect — the app pins chain 5042 and auto-switches.
3. Create a circle (members = one address per line, payout top→bottom), or open an existing one: `…/circle/0x…`.
4. Approve → Pay → (anyone) Trigger payout. Activity feed reads straight from contract logs — no subgraph needed.

**Local dev:**

```shell
forge build && forge test        # 9 tests, all green
cd web && npm install && npm run dev
```

Deploy: `forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.arc.io --broadcast`, then set `FACTORY_ADDRESS` in `web/lib/arc.ts`.

## Proven on mainnet (not a testnet demo)

- Factory `0x6792…C69` + two live circles on **Arc mainnet**, verified via `circleCount() == 2` against two independent RPCs.
- Circle `0xF1C1…0A0C` (3 members × 1 USDC): round 0 fully contributed and **paid out 3.0 USDC onchain** (contribute `0x6e18…86cae6`, payout `0x54bf…81a18f5e`, `currentRound == 1`).
- Circle `0x1a57…787e` (2 members × 1 USDC): round 0 paid out, on round 1/2.

## Roadmap

- **Now (Microgrants):** live factory + web app, mainnet proof rounds, public repo. Single-token (USDC) by design.
- **Next — reminders & reputation:** per-member payment history → a lightweight onchain punctuality score; circles can require a minimum score to join. Offchain cron (TBA) pings members before deadlines via Farcaster/Telegram.
- **Phase 2 — yield (Grant Program pitch):** onboard the operator via Circle Mint, point `yieldAdapter` at USYC so idle pots earn T-bill yield between rounds. Adapter interface is already in the contract; only the allowlisted holder is missing.
- **Later:** EURC circles for non-USD groups, multi-round auto-debit (EIP-7702 session intents), group discovery board.

## Repo map

```
src/SavingsCircle.sol      Circle + CircleFactory (no deps beyond forge-std in tests)
test/SavingsCircle.t.sol   9 forge tests (full lifecycle, penalties, reverts, gating)
script/Deploy.s.sol        factory deploy script
web/                       Next.js 16 + wagmi 3 + viem (no RainbowKit)
  lib/arc.ts               chain 5042, RPC fallbacks, USDC, ABIs
  lib/wagmi.tsx            fallback transport across 3 public RPCs
  components/CreateCircle  create flow (chain pinned to 5042)
  app/circle/[address]/    round dashboard, pay, payout, activity feed
broadcast/                 mainnet deploy receipts (committed as proof — safe, no keys)
```

## License

MIT — see [LICENSE](LICENSE).
