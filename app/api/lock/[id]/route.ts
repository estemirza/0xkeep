// GET /api/lock/0xK-BL-0 → public, read-only JSON for one lock.
import { readLock, handle } from "@/lib/onchainRead";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => readLock(id));
}
