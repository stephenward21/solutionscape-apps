import { NextResponse } from "next/server";
import { buildFreshSnapshot, buildErrorSnapshot } from "@/lib/build-snapshot";
import { loadSnapshot } from "@/lib/snapshot-store";
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
    const workspace = { id: entry.id, name: entry.name };
    const snapshot = await buildFreshSnapshot(workspace, entry.apiKey);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const existing = loadSnapshot(workspaceId);
    const workspace = { id: workspaceId, name: String(workspaceId) };
    return NextResponse.json(buildErrorSnapshot(workspace, message, existing), {
      status: 200, // return 200 with error field so UI can show graceful error state
    });
  }
}
