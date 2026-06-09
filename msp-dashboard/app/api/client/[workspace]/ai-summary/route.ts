import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";
import { getAISummary } from "@/lib/ai-summarizer";

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
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }

    const client = getClientForKey(entry.apiKey);

    const [controls, tasks, risks, tests] = await Promise.all([
      client.getControls(workspaceId),
      client.getTasks(workspaceId),
      client.getRisks(),
      client.getMonitoringTests(workspaceId),
    ]);

    const result = await getAISummary(
      workspaceId,
      entry.name,
      controls,
      tasks,
      risks,
      tests,
      forceRefresh
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
