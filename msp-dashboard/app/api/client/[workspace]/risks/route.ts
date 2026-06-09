import { NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";
import { getRiskSeverity } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceName = decodeURIComponent(params.workspace);
  const { searchParams } = new URL(req.url);
  const severityFilter = searchParams.get("severity") ?? undefined;
  const statusFilter = searchParams.get("status") ?? undefined;

  try {
    const client = getClient(workspaceName);
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
