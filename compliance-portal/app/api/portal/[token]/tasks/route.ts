import { NextResponse } from "next/server";
import { getValidPortal } from "@/lib/portal-store";
import { makeClient } from "@/lib/drata-client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const config = getValidPortal(params.token);
  if (!config) return NextResponse.json({ error: "Portal not found or expired" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? undefined;

  try {
    const client = makeClient(config.apiKey);
    let tasks = await client.getTasks(config.workspaceId);

    // Only return incomplete / past-due tasks by default (no reason to show completed)
    tasks = tasks.filter((t) => t.status !== "COMPLETED");

    if (statusFilter) {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    // Sort: PAST_DUE first, then by due date ascending
    tasks.sort((a, b) => {
      if (a.status === "PAST_DUE" && b.status !== "PAST_DUE") return -1;
      if (b.status === "PAST_DUE" && a.status !== "PAST_DUE") return 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
