// Server-side, read-only chain access for the public JSON API (app/api/*).
// No wallet, no keys, no writes — just eth_call against public/Alchemy RPCs.

import { createPublicClient, http, erc20Abi, formatUnits, type PublicClient } from "viem";
import { base, arbitrum, optimism } from "viem/chains";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { parseId, getExplorerAddressLink, getExplorerTokenLink, CHAIN_NAMES } from "@/lib/formatter";

const RPC: Record<number, { chain: typeof base | typeof arbitrum | typeof optimism; url?: string }> = {
  8453:  { chain: base,     url: process.env.NEXT_PUBLIC_RPC_BASE },
  42161: { chain: arbitrum, url: process.env.NEXT_PUBLIC_RPC_ARBITRUM },
  10:    { chain: optimism, url: process.env.NEXT_PUBLIC_RPC_OPTIMISM },
};

const clients: Record<number, PublicClient> = {};
export function client(chainId: number): PublicClient {
  if (!clients[chainId]) {
    const cfg = RPC[chainId];
    clients[chainId] = createPublicClient({ chain: cfg.chain, transport: http(cfg.url) }) as PublicClient;
  }
  return clients[chainId];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const ZERO = "0x0000000000000000000000000000000000000000";

function resolve(id: string, expected: "lock" | "vesting") {
  let parsed;
  try { parsed = parseId(decodeURIComponent(id)); }
  catch { throw new ApiError(400, `Invalid ID "${id}". Expected format 0xK-{B|A|O}{L|V}-{number}, e.g. 0xK-BL-0.`); }
  if (parsed.type !== expected) throw new ApiError(400, `"${id}" is a ${parsed.type}, not a ${expected}. Use /api/${parsed.type}/${id}.`);
  const contract = CONTRACT_ADDRESSES[parsed.chainId];
  if (!contract || !RPC[parsed.chainId]) throw new ApiError(404, `Chain ${parsed.chainId} is not supported.`);
  return { ...parsed, contract };
}

async function tokenSymbol(chainId: number, token: `0x${string}`): Promise<string | null> {
  try { return await client(chainId).readContract({ address: token, abi: erc20Abi, functionName: "symbol" }); }
  catch { return null; }
}

function common(chainId: number, contract: string, token: string) {
  return {
    chain: { id: chainId, name: CHAIN_NAMES[chainId] ?? String(chainId) },
    contract: { address: contract, explorer: getExplorerAddressLink(chainId, contract) },
    tokenExplorer: getExplorerTokenLink(chainId, token),
  };
}

export async function readLock(id: string) {
  const { rawId, chainId, contract } = resolve(id, "lock");
  const c = client(chainId);
  const [total, lock] = await Promise.all([
    c.readContract({ address: contract, abi: CONTRACT_ABI, functionName: "allLocksCount" }),
    c.readContract({ address: contract, abi: CONTRACT_ABI, functionName: "locks", args: [rawId] }),
  ]);
  const [token, amount, owner, decimals, withdrawn, unlockTime] = lock;
  if (rawId >= total || token === ZERO) throw new ApiError(404, `Lock ${id} does not exist.`);

  const unlockTs = Number(unlockTime);
  const now = Math.floor(Date.now() / 1000);
  const status = withdrawn ? "withdrawn" : now >= unlockTs ? "unlocked" : "locked";
  const { chain, contract: contractInfo, tokenExplorer } = common(chainId, contract, token);

  return {
    id: decodeURIComponent(id),
    type: "lock",
    status,
    chain,
    contract: contractInfo,
    token: { address: token, symbol: await tokenSymbol(chainId, token), decimals, explorer: tokenExplorer },
    amount: { raw: amount.toString(), formatted: formatUnits(amount, decimals) },
    owner,
    unlockTime: { unix: unlockTs, iso: new Date(unlockTs * 1000).toISOString() },
    withdrawn,
    certificate: `https://app.0x-keep.xyz/lock/${decodeURIComponent(id)}`,
    readAt: new Date(now * 1000).toISOString(),
  };
}

export async function readVesting(id: string) {
  const { rawId, chainId, contract } = resolve(id, "vesting");
  const c = client(chainId);
  const [total, vest] = await Promise.all([
    c.readContract({ address: contract, abi: CONTRACT_ABI, functionName: "allVestingsCount" }),
    c.readContract({ address: contract, abi: CONTRACT_ABI, functionName: "vestings", args: [rawId] }),
  ]);
  const [token, totalAmount, owner, decimals, claimedAmount, startTime, cliffDuration, duration] = vest;
  if (rawId >= total || token === ZERO) throw new ApiError(404, `Vesting ${id} does not exist.`);

  const now = Math.floor(Date.now() / 1000);
  const start = Number(startTime), cliff = Number(cliffDuration), dur = Number(duration);
  const cliffEnd = start + cliff;

  // Same integer math as claimVesting() in the contract.
  let vested = BigInt(0);
  if (now >= cliffEnd) {
    const passed = BigInt(now - cliffEnd);
    const a = BigInt(totalAmount), d = BigInt(dur);
    vested = passed >= d ? a : (a / d) * passed + ((a % d) * passed) / d;
  }
  const claimable = vested > BigInt(claimedAmount) ? vested - BigInt(claimedAmount) : BigInt(0);
  const fmt = (v: bigint) => ({ raw: v.toString(), formatted: formatUnits(v, decimals) });

  const status = BigInt(claimedAmount) === BigInt(totalAmount) ? "completed"
    : now < cliffEnd ? "in_cliff" : now >= cliffEnd + dur ? "fully_vested" : "vesting";
  const { chain, contract: contractInfo, tokenExplorer } = common(chainId, contract, token);

  return {
    id: decodeURIComponent(id),
    type: "vesting",
    status,
    chain,
    contract: contractInfo,
    token: { address: token, symbol: await tokenSymbol(chainId, token), decimals, explorer: tokenExplorer },
    owner,
    total: fmt(BigInt(totalAmount)),
    claimed: fmt(BigInt(claimedAmount)),
    vestedNow: fmt(vested),
    claimableNow: fmt(claimable),
    schedule: {
      start: { unix: start, iso: new Date(start * 1000).toISOString() },
      cliffEnd: { unix: cliffEnd, iso: new Date(cliffEnd * 1000).toISOString() },
      end: { unix: cliffEnd + dur, iso: new Date((cliffEnd + dur) * 1000).toISOString() },
      cliffSeconds: cliff,
      durationSeconds: dur,
    },
    certificate: `https://app.0x-keep.xyz/vesting/${decodeURIComponent(id)}`,
    readAt: new Date(now * 1000).toISOString(),
  };
}

// Shared JSON response: public, cacheable for 30s at the edge, open CORS (read-only data).
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, s-maxage=30, stale-while-revalidate=60" : "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function handle(fn: () => Promise<unknown>) {
  try { return json(await fn()); }
  catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    return json({ error: "Could not read from the chain right now. Try again shortly." }, 502);
  }
}
