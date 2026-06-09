import { NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceName = decodeURIComponent(params.workspace);
  const { searchParams } = new URL(req.url);
  const frameworkSlug = searchParams.get("frameworkSlug") ?? undefined;
  const statusFilter = searchParams.get("status") ?? undefined;

  try {
    const client = getClient(workspaceName);
    let controls = await client.getControls(frameworkSlug ? { frameworkSlug } : undefined);

    if (statusFilter) {
      controls = controls.filter((c) => c.status === statusFilter);
    }

    return NextResponse.json({ controls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
