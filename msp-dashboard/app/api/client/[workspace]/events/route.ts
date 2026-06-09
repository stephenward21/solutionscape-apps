import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }
    const client = getClientForKey(entry.apiKey);
    const events = await client.getEvents(workspaceId, 20);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
