// GET /api/token/8453/0xTokenOrLpAddress → every active 0xKeep lock and vesting
// for that token on that chain, plus a GoPlus-shaped `locked_detail`.
// Built for security scanners and integrators. Public, read-only.
import { handle } from "@/lib/onchainRead";
import { readTokenLocks } from "@/lib/tokenLocks";

export async function GET(_req: Request, { params }: { params: Promise<{ chainId: string; address: string }> }) {
  const { chainId, address } = await params;
  return handle(() => readTokenLocks(chainId, address));
}
