// "Show me every 0xKeep lock for token X" — the question security scanners
// (GoPlus, DexScreener, DEXTools, ...) ask before marking liquidity as locked.
// Read-only. Returns current state plus a GoPlus-shaped `locked_detail`.

import { erc20Abi, formatUnits, getAddress, isAddress, parseAbiItem } from "viem";
import { CONTRACT_ABI, CONTRACT_ADDRESSES } from "@/lib/contract";
import { CHAIN_NAMES, formatLockId, formatVestingId, getExplorerAddressLink } from "@/lib/formatter";
import { ApiError, client } from "@/lib/onchainRead";

const LOCKED_EVENT = parseAbiItem(
  "event Locked(uint256 indexed lockId, address indexed token, address indexed owner, uint256 amount, uint256 unlockTime, uint256 chainId)"
);

// Enumerating every lock is fine while counts are small. Above this, integrators
// should index the Locked / VestingCreated events instead (see /agents.html).
const MAX_SCAN = 5000;
const BATCH = 500;

// Deployment block per locker, so event lookups don't scan from genesis.
// Known ones are hardcoded; others are found once by binary search on getCode.
const KNOWN_DEPLOY_BLOCK: Record<string, bigint> = {
  "0x048d1326b3b0531a5d043984f4e495285b07af4b": BigInt(51730030), // Base growth instance
};
const deployBlockCache: Record<string, bigint> = {};

async function deployBlock(chainId: number, contract: `0x${string}`): Promise<bigint> {
  const key = contract.toLowerCase();
  if (KNOWN_DEPLOY_BLOCK[key]) return KNOWN_DEPLOY_BLOCK[key];
  if (deployBlockCache[key]) return deployBlockCache[key];
  const c = client(chainId);
  let lo = BigInt(0), hi = await c.getBlockNumber();
  while (lo < hi) {
    const mid = (lo + hi) / BigInt(2);
    const code = await c.getCode({ address: contract, blockNumber: mid });
    if (code && code !== "0x") hi = mid; else lo = mid + BigInt(1);
  }
  deployBlockCache[key] = lo;
  return lo;
}

// Best effort: lock creation time (GoPlus `opt_time`) lives only in the Locked event.
async function lockTimes(chainId: number, contract: `0x${string}`, token: `0x${string}`) {
  const out: Record<string, number> = {};
  try {
    const c = client(chainId);
    const logs = await c.getLogs({
      address: contract,
      event: LOCKED_EVENT,
      args: { token },
      fromBlock: await deployBlock(chainId, contract),
      toBlock: "latest",
    });
    const blocks = [...new Set(logs.map((l) => l.blockNumber))];
    const ts: Record<string, number> = {};
    await Promise.all(blocks.map(async (b) => {
      if (b === null) return;
      ts[b.toString()] = Number((await c.getBlock({ blockNumber: b })).timestamp);
    }));
    for (const l of logs) {
      if (l.args.lockId !== undefined && l.blockNumber !== null) out[l.args.lockId.toString()] = ts[l.blockNumber.toString()];
    }
  } catch {
    // RPC refused the range (some providers cap getLogs). Fields stay null.
  }
  return out;
}

async function readAll<T>(chainId: number, contract: `0x${string}`, fn: "locks" | "vestings", count: number) {
  const c = client(chainId);
  const rows: T[] = [];
  for (let start = 0; start < count; start += BATCH) {
    const ids = Array.from({ length: Math.min(BATCH, count - start) }, (_, i) => BigInt(start + i));
    const res = await c.multicall({
      contracts: ids.map((id) => ({ address: contract, abi: CONTRACT_ABI, functionName: fn, args: [id] })),
      allowFailure: false,
    });
    rows.push(...(res as T[]));
  }
  return rows;
}

const iso = (s: number) => new Date(s * 1000).toISOString();

export async function readTokenLocks(chainParam: string, tokenParam: string) {
  const chainId = Number(chainParam);
  const contract = CONTRACT_ADDRESSES[chainId];
  if (!contract || !CHAIN_NAMES[chainId]) throw new ApiError(404, `Chain "${chainParam}" is not supported. Use 8453 (Base), 42161 (Arbitrum) or 10 (Optimism).`);
  if (!isAddress(tokenParam)) throw new ApiError(400, `"${tokenParam}" is not a valid token address.`);
  const token = getAddress(tokenParam);
  const c = client(chainId);

  const [lockCount, vestCount] = await Promise.all([
    c.readContract({ address: contract, abi: CONTRACT_ABI, functionName: "allLocksCount" }),
    c.readContract({ address: contract, abi: CONTRACT_ABI, functionName: "allVestingsCount" }),
  ]);
  if (lockCount + vestCount > BigInt(MAX_SCAN)) {
    throw new ApiError(503, `Too many locks to scan on request. Index the Locked/VestingCreated events of ${contract} instead.`);
  }

  const [locks, vests, tokenMeta, times] = await Promise.all([
    readAll<readonly [string, bigint, string, number, boolean, number, bigint]>(chainId, contract, "locks", Number(lockCount)),
    readAll<readonly [string, bigint, string, number, bigint, number, number, number, bigint]>(chainId, contract, "vestings", Number(vestCount)),
    Promise.all([
      c.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => null),
      c.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
      c.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }).catch(() => null),
    ]),
    lockTimes(chainId, contract, token),
  ]);
  const [symbol, decimals, totalSupply] = tokenMeta;
  const now = Math.floor(Date.now() / 1000);
  const same = (a: string) => a.toLowerCase() === token.toLowerCase();
  const fmt = (v: bigint) => ({ raw: v.toString(), formatted: formatUnits(v, Number(decimals)) });

  const activeLocks = locks
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => same(l[0]) && !l[4] && l[1] > BigInt(0))
    .map(({ l, i }) => ({
      id: formatLockId(i, chainId),
      amount: fmt(l[1]),
      owner: l[2],
      unlockTime: { unix: Number(l[5]), iso: iso(Number(l[5])) },
      lockedAt: times[String(i)] ? { unix: times[String(i)], iso: iso(times[String(i)]) } : null,
      status: now >= Number(l[5]) ? "unlocked_not_withdrawn" : "locked",
    }));

  const activeVestings = vests
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => same(v[0]) && v[4] < v[1])
    .map(({ v, i }) => {
      const start = Number(v[5]), cliffEnd = start + Number(v[6]), end = cliffEnd + Number(v[7]);
      return {
        id: formatVestingId(i, chainId),
        remaining: fmt(v[1] - v[4]),
        owner: v[2],
        start: { unix: start, iso: iso(start) },
        cliffEnd: { unix: cliffEnd, iso: iso(cliffEnd) },
        end: { unix: end, iso: iso(end) },
      };
    });

  const lockedNow = activeLocks
    .filter((l) => l.status === "locked")
    .reduce((s, l) => s + BigInt(l.amount.raw), BigInt(0));
  const pct = totalSupply && totalSupply > BigInt(0)
    ? Number((lockedNow * BigInt(1_000_000)) / totalSupply) / 1_000_000
    : null;

  return {
    chain: { id: chainId, name: CHAIN_NAMES[chainId] },
    locker: { name: "0xKeep", version: "V12", contract, explorer: getExplorerAddressLink(chainId, contract) },
    token: { address: token, symbol, decimals: Number(decimals), totalSupply: totalSupply === null ? null : totalSupply.toString() },
    summary: {
      activeLocks: activeLocks.length,
      activeVestings: activeVestings.length,
      lockedNow: fmt(lockedNow),
      percentOfSupplyLocked: pct, // 1 = 100%
      nextUnlock: activeLocks.filter((l) => l.status === "locked").sort((a, b) => a.unlockTime.unix - b.unlockTime.unix)[0]?.unlockTime ?? null,
    },
    locks: activeLocks,
    vestings: activeVestings,
    // Same shape as GoPlus Token Security `lp_holders[].locked_detail`.
    goplus: {
      address: contract,
      is_locked: lockedNow > BigInt(0) ? 1 : 0,
      locked_detail: activeLocks
        .filter((l) => l.status === "locked")
        .map((l) => ({
          amount: l.amount.formatted,
          end_time: l.unlockTime.iso,
          opt_time: l.lockedAt?.iso ?? null,
        })),
    },
    readAt: iso(now),
  };
}
