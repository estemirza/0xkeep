// GET /api/vesting/0xK-BV-0 → public, read-only JSON for one vesting schedule.
import { readVesting, handle } from "@/lib/onchainRead";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => readVesting(id));
}
