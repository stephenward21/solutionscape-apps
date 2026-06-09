import { NextResponse } from "next/server";
import { buildFreshSnapshot, buildErrorSnapshot } from "@/lib/build-snapshot";
import { loadSnapshot } from "@/lib/snapshot-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceName = decodeURIComponent(params.workspace);

  try {
    const snapshot = await buildFreshSnapshot(workspaceName);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const existing = loadSnapshot(workspaceName);
    return NextResponse.json(buildErrorSnapshot(workspaceName, message, existing), {
      status: 200, // return 200 with error field so UI can show graceful error state
    });
  }
}
