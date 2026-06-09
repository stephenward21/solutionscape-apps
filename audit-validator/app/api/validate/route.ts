/**
 * POST /api/validate
 *
 * Accepts evidence files + control mappings, runs Claude validation,
 * saves and returns the report.
 *
 * The request body is JSON (files are base64-encoded by the client).
 * Max payload is large — set in Next.js config.
 */
import { NextResponse } from "next/server";
import { validateEvidence } from "@/lib/claude-validator";
import { saveReport } from "@/lib/report-store";
import type { ValidateRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

// Allow large payloads for file uploads
export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

export async function POST(req: Request): Promise<NextResponse> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body: ValidateRequest;
  try {
    body = (await req.json()) as ValidateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { files, mappings, controls, workspaceId, workspaceName } = body;

  if (!files?.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });
  if (!mappings?.length) return NextResponse.json({ error: "No control mappings provided" }, { status: 400 });
  if (!controls?.length) return NextResponse.json({ error: "No controls provided" }, { status: 400 });

  try {
    const report = await validateEvidence(
      anthropicKey,
      workspaceId,
      workspaceName,
      files,
      mappings,
      controls
    );

    saveReport(report);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
