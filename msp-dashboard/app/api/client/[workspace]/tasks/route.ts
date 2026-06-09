import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getOverdueTasks, getUpcomingTasks } from "@/lib/health-calculator";
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
  const filter = searchParams.get("filter") ?? "all";

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }
    const client = getClientForKey(entry.apiKey);
    const allTasks = await client.getTasks(workspaceId);

    const overdue = getOverdueTasks(allTasks);
    const upcoming = getUpcomingTasks(allTasks);

    let tasks = allTasks;
    if (filter === "overdue") tasks = overdue;
    else if (filter === "upcoming") tasks = upcoming;

    return NextResponse.json({
      tasks,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
