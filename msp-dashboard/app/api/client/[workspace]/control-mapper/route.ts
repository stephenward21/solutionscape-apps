/**
 * POST /api/client/[workspace]/control-mapper
 * Body: { url: string }
 *
 * Downloads the file(s) at `url` (Google Drive, OneDrive, or direct),
 * fetches all controls for the workspace, then asks Claude to recommend
 * which controls each file maps to.
 */
import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";
import { mapFilesToControls } from "@/lib/control-mapper";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes — zip files with many entries can take a while
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on this server" },
      { status: 500 }
    );
  }

  let url: string;
  try {
    const body = (await req.json()) as { url?: string };
    url = (body.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body — expected { url: string }" }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Basic sanity check — must be HTTPS
  if (!url.startsWith("https://")) {
    return NextResponse.json(
      { error: "URL must start with https://" },
      { status: 400 }
    );
  }

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }

    const client = getClientForKey(entry.apiKey);

    // Fetch all controls for this workspace (used to build the recommendation list)
    const controls = await client.getControls(workspaceId);

    const result = await mapFilesToControls(workspaceId, url, controls);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
