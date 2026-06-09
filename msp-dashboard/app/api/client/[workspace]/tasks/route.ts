import { NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";
import { getOverdueTasks, getUpcomingTasks } from "@/lib/health-calculator";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceName = decodeURIComponent(params.workspace);
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";

  try {
    const client = getClient(workspaceName);
    const allTasks = await client.getTasks();

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
