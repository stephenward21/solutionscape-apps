import { NextResponse } from "next/server";
import { getValidPortal } from "@/lib/portal-store";
import { makeClient } from "@/lib/drata-client";
import { getRiskSeverity } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const config = getValidPortal(params.token);
  if (!config) return NextResponse.json({ error: "Portal not found or expired" }, { status: 404 });
  if (!config.showRisks) return NextResponse.json({ risks: [] });

  const { searchParams } = new URL(req.url);
  const severityFilter = searchParams.get("severity") ?? undefined;

  try {
    const client = makeClient(config.apiKey);
    let risks = await client.getRisks();

    // Default: only active risks
    risks = risks.filter((r) => r.status === "ACTIVE");

    if (severityFilter) {
      risks = risks.filter((r) => getRiskSeverity(r) === severityFilter);
    }

    // Sort by score descending
    risks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return NextResponse.json({ risks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
