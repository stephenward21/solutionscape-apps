import { NextResponse } from "next/server";
import { getValidPortal } from "@/lib/portal-store";
import { makeClient } from "@/lib/drata-client";
import { getAIPriorities } from "@/lib/ai-prioritizer";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const config = getValidPortal(params.token);
  if (!config) {
    return NextResponse.json({ error: "Portal not found or expired" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
    const client = makeClient(config.apiKey);

    const [controls, tasks, risks, tests] = await Promise.all([
      client.getControls(config.workspaceId),
      client.getTasks(config.workspaceId),
      config.showRisks ? client.getRisks() : Promise.resolve([]),
      client.getMonitoringTests(config.workspaceId),
    ]);

    const result = await getAIPriorities(
      {
        workspaceId: config.workspaceId,
        workspaceName: config.workspaceName,
        controls,
        tasks,
        risks,
        tests,
      },
      forceRefresh
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
