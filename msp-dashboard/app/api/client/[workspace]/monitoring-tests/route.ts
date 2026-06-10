/**
 * GET /api/client/[workspace]/monitoring-tests
 * Returns the full list of monitoring tests for a workspace plus aggregate counts.
 */
import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";
import type { DrataMonitoringTest } from "@/lib/types";

export const dynamic = "force-dynamic";

function summarize(tests: DrataMonitoringTest[]) {
  const total    = tests.length;
  const passing  = tests.filter((t) => t.checkResultStatus === "PASSED").length;
  const failing  = tests.filter((t) => t.checkResultStatus === "FAILED").length;
  const error    = tests.filter((t) => t.checkResultStatus === "ERROR").length;
  const preaudit = tests.filter((t) => t.checkResultStatus === "PREAUDIT").length;
  const disabled = tests.filter(
    (t) => t.checkStatus === "DISABLED" || t.checkStatus === "UNUSED"
  ).length;
  const enabled  = tests.filter((t) => t.checkStatus === "ENABLED").length;
  const passRate = enabled > 0 ? Math.round((passing / enabled) * 100) : 0;
  return { total, passing, failing, error, preaudit, disabled, enabled, passRate };
}

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
    const tests = await client.getMonitoringTests(workspaceId);
    return NextResponse.json({ tests, counts: summarize(tests) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
