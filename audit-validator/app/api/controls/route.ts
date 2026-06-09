import { NextResponse } from "next/server";
import { makeClient } from "@/lib/drata-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get("apiKey");
  const workspaceId = parseInt(searchParams.get("workspaceId") ?? "", 10);
  if (!apiKey) return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  if (isNaN(workspaceId)) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  try {
    const client = makeClient(apiKey);
    const controls = await client.getControls(workspaceId);
    // Exclude archived controls
    const active = controls.filter((c) => !c.archivedAt);
    return NextResponse.json({ controls: active });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
