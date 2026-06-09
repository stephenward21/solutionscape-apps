import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getRiskSeverity } from "@/lib/types";
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
  const severityFilter = searchParams.get("severity") ?? undefined;
  const statusFilter = searchParams.get("status") ?? undefined;

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }
    const client = getClientForKey(entry.apiKey);
    let risks = await client.getRisks();

    // v2: severity is derived from risk.score, not a string field
    if (severityFilter) {
      risks = risks.filter((r) => getRiskSeverity(r) === severityFilter);
    }
    if (statusFilter) {
      risks = risks.filter((r) => r.status === statusFilter);
    }

    return NextResponse.json({ risks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
