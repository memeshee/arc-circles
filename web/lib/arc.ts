import { defineChain } from "viem";

export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
});

// Native USDC ERC-20 view on Arc (6 decimals). Same asset as gas (18-decimal native view) — never double-count.
export const USDC = "0x3600000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;
export const EXPLORER = "https://explorer.arc.io";

// Set by deploy (web/lib/deployed.ts is rewritten at deploy time).
export const FACTORY_ADDRESS =
  "0x6792E51FBD24f9315282BD5b6c5E713dCc779C69" as const;

export const factoryAbi = [
  {
    type: "function",
    name: "createCircle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "contribution", type: "uint256" },
      { name: "roundDuration", type: "uint256" },
      { name: "members", type: "address[]" },
      { name: "penaltyBps", type: "uint256" },
    ],
    outputs: [{ name: "circle", type: "address" }],
  },
  {
    type: "function",
    name: "allCircles",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "circleCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "CircleCreated",
    inputs: [
      { name: "circle", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "contribution", type: "uint256", indexed: false },
      { name: "roundDuration", type: "uint256", indexed: false },
      { name: "memberCount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const circleAbi = [
  { type: "function", name: "contribute", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "contributeFor",
    stateMutability: "nonpayable",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
  },
  { type: "function", name: "payout", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "contribution", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "roundDuration", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "startTime", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "penaltyBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentRound", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "complete", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "memberCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "members",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "paid",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "roundDeadline",
    stateMutability: "view",
    inputs: [{ name: "round", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "recipientOf",
    stateMutability: "view",
    inputs: [{ name: "round", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "roundFullyPaid",
    stateMutability: "view",
    inputs: [{ name: "round", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "totalRounds", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "Contributed",
    inputs: [
      { name: "round", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "penalty", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaidOut",
    inputs: [
      { name: "round", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "CircleCompleted", inputs: [] },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function fmtUSDC(raw: bigint): string {
  const zero = BigInt(0);
  const unit = BigInt(1000000);
  const neg = raw < zero ? "-" : "";
  const v = raw < zero ? -raw : raw;
  const int = v / unit;
  const frac = (v % unit).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg}${int.toString()}${frac ? "." + frac : ""}`;
}
