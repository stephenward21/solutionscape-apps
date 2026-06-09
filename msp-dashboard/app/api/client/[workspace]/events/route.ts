import { NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceName = decodeURIComponent(params.workspace);

  try {
    const client = getClient(workspaceName);
    const events = await client.getEvents(20);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
