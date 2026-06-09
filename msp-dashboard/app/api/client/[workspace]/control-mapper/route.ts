/**
 * POST /api/client/[workspace]/control-mapper
 *
 * Accepts two input modes:
 *   1. JSON body { url: string }           — downloads from Google Drive/OneDrive/direct URL
 *   2. multipart/form-data { file: File }  — local file or zip upload
 *
 * Returns ControlMappingResult with Claude's recommended control mappings.
 */
import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";
import { mapFilesFromUrl, mapFilesFromBuffer } from "@/lib/control-mapper";

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

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }

    const client = getClientForKey(entry.apiKey);
    const controls = await client.getControls(workspaceId);

    const contentType = req.headers.get("content-type") ?? "";

    // ── Mode 1: file upload ───────────────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json({ error: "Could not parse form data" }, { status: 400 });
      }

      const fileEntry = formData.get("file");
      if (!fileEntry || typeof fileEntry === "string") {
        return NextResponse.json({ error: "No file found in form data" }, { status: 400 });
      }

      const file = fileEntry as File;
      if (file.size === 0) {
        return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
      }

      const MAX_UPLOAD = 50 * 1024 * 1024; // 50 MB for zips (individual files capped inside)
      if (file.size > MAX_UPLOAD) {
        return NextResponse.json(
          { error: "File too large (max 50 MB). For large zip files, try uploading subsets." },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mapFilesFromBuffer(
        workspaceId,
        file.name,
        buffer,
        file.type || "application/octet-stream",
        controls
      );
      return NextResponse.json(result);
    }

    // ── Mode 2: URL ───────────────────────────────────────────────────────────
    let url: string;
    try {
      const body = (await req.json()) as { url?: string };
      url = (body.url ?? "").trim();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body — expected { url: string } or multipart file upload" },
        { status: 400 }
      );
    }

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
    }

    const result = await mapFilesFromUrl(workspaceId, url, controls);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
