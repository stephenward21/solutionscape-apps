import { NextResponse } from "next/server";
import { getValidPortal } from "@/lib/portal-store";
import { buildSnapshot } from "@/lib/snapshot-builder";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const config = getValidPortal(params.token);
  if (!config) {
    return NextResponse.json({ error: "Portal not found or expired" }, { status: 404 });
  }
  try {
    const snapshot = await buildSnapshot(config);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
