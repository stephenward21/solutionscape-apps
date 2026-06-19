/**
 * GET /api/portal/[token]/monitoring-tests
 * Returns all monitoring tests + aggregate counts for the portal workspace.
 */
import { NextResponse } from "next/server";
import { getValidPortal } from "@/lib/portal-store";
import { makeClient } from "@/lib/drata-client";
import type { DrataMonitoringTest } from "@/lib/types";

export const dynamic = "force-dynamic";

const INACTIVE_STATUSES = new Set(["DISABLED", "UNUSED", "NEW", "TESTING"]);

function summarize(tests: DrataMonitoringTest[]) {
  const total    = tests.length;
  const inactive = tests.filter((t) => t.checkStatus && INACTIVE_STATUSES.has(t.checkStatus)).length;
  const enabled  = tests.filter((t) => t.checkStatus === "ENABLED").length;
  const passing  = tests.filter((t) => t.checkStatus === "ENABLED" && t.checkResultStatus === "PASSED").length;
  const failing  = tests.filter((t) => t.checkStatus === "ENABLED" && t.checkResultStatus === "FAILED").length;
  const error    = tests.filter((t) => t.checkStatus === "ENABLED" && t.checkResultStatus === "ERROR").length;
  const preaudit = tests.filter((t) => t.checkStatus === "ENABLED" && t.checkResultStatus === "PREAUDIT").length;
  const passRate = enabled > 0 ? Math.round((passing / enabled) * 100) : 0;
  return { total, inactive, enabled, passing, failing, error, preaudit, passRate };
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const config = getValidPortal(params.token);
  if (!config) {
    return NextResponse.json({ error: "Portal not found or expired" }, { status: 404 });
  }

  try {
    const client = makeClient(config.apiKey);
    const tests = await client.getMonitoringTests(config.workspaceId);
    return NextResponse.json({ tests, counts: summarize(tests) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
