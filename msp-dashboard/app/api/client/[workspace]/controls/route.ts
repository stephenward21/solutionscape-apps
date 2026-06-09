import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getControlStatus } from "@/lib/types";
import { getWorkspaceEntry } from "@/lib/workspace-cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? undefined;

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }
    const client = getClientForKey(entry.apiKey);
    let controls = await client.getControls(workspaceId);

    // v2: filter by derived status (from nested flags)
    if (statusFilter) {
      controls = controls.filter((c) => getControlStatus(c) === statusFilter);
    }

    return NextResponse.json({ controls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
