import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getClient } from "@/lib/drata-client";
import { appendSyncLog, listSyncLog } from "@/lib/sync-log-store";
import { hashFile, getMimeType } from "@/lib/file-utils";
import type { SyncLogEntry } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const workspace = searchParams.get("workspace") ?? undefined;
  const controlIdStr = searchParams.get("controlId");
  const controlId = controlIdStr ? Number(controlIdStr) : undefined;

  try {
    const client = getClient(workspace);
    const evidence = await client.getEvidenceList(controlId);
    return NextResponse.json({ evidence });
  } catch (error) {
    console.error("Failed to fetch evidence:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch evidence" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const workspace = (formData.get("workspace") as string | null) ?? undefined;
    const controlIdStr = formData.get("controlId") as string | null;
    const description = (formData.get("description") as string | null) ?? "";
    const collectedAt = (formData.get("collectedAt") as string | null) ?? new Date().toISOString();
    const fileEntry = formData.get("file");
    const controlName = (formData.get("controlName") as string | null) ?? "";
    const controlCode = (formData.get("controlCode") as string | null) ?? "";

    if (!controlIdStr) {
      return NextResponse.json({ error: "controlId is required" }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const controlId = Number(controlIdStr);
    const fileName = fileEntry.name;
    const mimeType = getMimeType(fileName);
    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = await hashFile(buffer);
    const fileSize = buffer.length;

    // Dedup check: same hash + controlId in sync log
    const existingLogs = listSyncLog();
    const duplicate = existingLogs.find(
      (e) => e.fileHash === fileHash && e.controlId === controlId && e.status === "success"
    );

    if (duplicate) {
      const entry: SyncLogEntry = {
        id: uuidv4(),
        workspaceName: workspace ?? "Default",
        fileName,
        fileSize,
        mimeType,
        controlId,
        controlName,
        controlCode,
        description,
        collectedAt,
        uploadedAt: new Date().toISOString(),
        status: "skipped",
        errorMessage: "Duplicate file (same hash already uploaded to this control)",
        fileHash,
      };
      appendSyncLog(entry);
      return NextResponse.json({ success: true, entry });
    }

    const client = getClient(workspace);
    const drataEvidence = await client.uploadEvidence(
      buffer,
      fileName,
      mimeType,
      controlId,
      description,
      collectedAt
    );

    const entry: SyncLogEntry = {
      id: uuidv4(),
      workspaceName: workspace ?? "Default",
      fileName,
      fileSize,
      mimeType,
      controlId,
      controlName,
      controlCode,
      description,
      collectedAt,
      uploadedAt: new Date().toISOString(),
      status: "success",
      drataEvidenceId: drataEvidence.id,
      fileHash,
    };

    appendSyncLog(entry);
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error("Failed to upload evidence:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
