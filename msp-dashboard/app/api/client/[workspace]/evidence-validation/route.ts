/**
 * GET  /api/client/[workspace]/evidence-validation         — return cached result or null
 * POST /api/client/[workspace]/evidence-validation         — run a fresh validation
 */
import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";
import { validateEvidenceLibrary, getCachedEvidenceValidation } from "@/lib/evidence-validator";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }
  const cached = getCachedEvidenceValidation(workspaceId);
  return NextResponse.json({ cached: cached ?? null });
}

export async function POST(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }

    const client = getClientForKey(entry.apiKey);

    // Fetch evidence library + controls in parallel
    const [evidenceItems, controls] = await Promise.all([
      client.getEvidenceLibrary(workspaceId),
      client.getControls(workspaceId),
    ]);

    const result = await validateEvidenceLibrary(
      workspaceId,
      entry.apiKey,
      evidenceItems,
      controls
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
