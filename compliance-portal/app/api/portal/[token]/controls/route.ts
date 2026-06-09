import { NextResponse } from "next/server";
import { getValidPortal } from "@/lib/portal-store";
import { makeClient } from "@/lib/drata-client";
import { getControlStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const config = getValidPortal(params.token);
  if (!config) return NextResponse.json({ error: "Portal not found or expired" }, { status: 404 });
  if (!config.showControls) return NextResponse.json({ controls: [] });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? undefined;

  try {
    const client = makeClient(config.apiKey);
    let controls = await client.getControls(config.workspaceId);
    if (statusFilter) {
      controls = controls.filter((c) => getControlStatus(c) === statusFilter);
    }
    return NextResponse.json({ controls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
