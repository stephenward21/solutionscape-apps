import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import { getClient } from "@/lib/drata-client";
import { appendSyncLog, listSyncLog } from "@/lib/sync-log-store";
import { hashFile, getMimeType } from "@/lib/file-utils";
import type { SyncLogEntry, BulkMapping } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const workspace = (formData.get("workspace") as string | null) ?? undefined;
    const csvFileEntry = formData.get("csvFile");
    const zipFileEntry = formData.get("zipFile");

    if (!(csvFileEntry instanceof File)) {
      return NextResponse.json({ error: "csvFile is required" }, { status: 400 });
    }
    if (!(zipFileEntry instanceof File)) {
      return NextResponse.json({ error: "zipFile is required" }, { status: 400 });
    }

    // Parse CSV
    const csvText = await csvFileEntry.text();
    const rawRows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const mappings: BulkMapping[] = rawRows.map((row) => ({
      fileName: row["fileName"] ?? row["filename"] ?? "",
      controlId: Number(row["controlId"] ?? row["control_id"] ?? 0),
      description: row["description"] ?? "",
      collectedAt: row["collectedAt"] ?? row["collected_at"] ?? new Date().toISOString(),
    }));

    // Load ZIP
    const zipBuffer = Buffer.from(await zipFileEntry.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBuffer);

    const client = getClient(workspace);
    const existingLogs = listSyncLog();
    const results: SyncLogEntry[] = [];

    for (const mapping of mappings) {
      if (!mapping.fileName || !mapping.controlId) {
        const entry: SyncLogEntry = {
          id: uuidv4(),
          workspaceName: workspace ?? "Default",
          fileName: mapping.fileName || "(unknown)",
          fileSize: 0,
          mimeType: "application/octet-stream",
          controlId: mapping.controlId ?? 0,
          controlName: "",
          controlCode: "",
          description: mapping.description ?? "",
          collectedAt: mapping.collectedAt ?? new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          status: "error",
          errorMessage: "Missing fileName or controlId in CSV row",
          fileHash: "",
        };
        appendSyncLog(entry);
        results.push(entry);
        continue;
      }

      // Find the file in the zip (search by name, case-insensitive)
      const zipEntry = Object.values(zip.files).find(
        (f) => !f.dir && f.name.split("/").pop()?.toLowerCase() === mapping.fileName.toLowerCase()
      );

      if (!zipEntry) {
        const entry: SyncLogEntry = {
          id: uuidv4(),
          workspaceName: workspace ?? "Default",
          fileName: mapping.fileName,
          fileSize: 0,
          mimeType: "application/octet-stream",
          controlId: mapping.controlId,
          controlName: "",
          controlCode: "",
          description: mapping.description ?? "",
          collectedAt: mapping.collectedAt ?? new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          status: "error",
          errorMessage: `File "${mapping.fileName}" not found in ZIP`,
          fileHash: "",
        };
        appendSyncLog(entry);
        results.push(entry);
        continue;
      }

      const fileData = await zipEntry.async("nodebuffer");
      const buffer = Buffer.from(fileData);
      const mimeType = getMimeType(mapping.fileName);
      const fileHash = await hashFile(buffer);
      const fileSize = buffer.length;

      // Dedup check
      const duplicate = existingLogs.find(
        (e) =>
          e.fileHash === fileHash &&
          e.controlId === mapping.controlId &&
          e.status === "success"
      );

      if (duplicate) {
        const entry: SyncLogEntry = {
          id: uuidv4(),
          workspaceName: workspace ?? "Default",
          fileName: mapping.fileName,
          fileSize,
          mimeType,
          controlId: mapping.controlId,
          controlName: "",
          controlCode: "",
          description: mapping.description ?? "",
          collectedAt: mapping.collectedAt ?? new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          status: "skipped",
          errorMessage: "Duplicate file (same hash already uploaded to this control)",
          fileHash,
        };
        appendSyncLog(entry);
        results.push(entry);
        continue;
      }

      try {
        const drataEvidence = await client.uploadEvidence(
          buffer,
          mapping.fileName,
          mimeType,
          mapping.controlId,
          mapping.description ?? "",
          mapping.collectedAt ?? new Date().toISOString()
        );

        const entry: SyncLogEntry = {
          id: uuidv4(),
          workspaceName: workspace ?? "Default",
          fileName: mapping.fileName,
          fileSize,
          mimeType,
          controlId: mapping.controlId,
          controlName: "",
          controlCode: "",
          description: mapping.description ?? "",
          collectedAt: mapping.collectedAt ?? new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          status: "success",
          drataEvidenceId: drataEvidence.id,
          fileHash,
        };

        appendSyncLog(entry);
        results.push(entry);
      } catch (uploadError) {
        const entry: SyncLogEntry = {
          id: uuidv4(),
          workspaceName: workspace ?? "Default",
          fileName: mapping.fileName,
          fileSize,
          mimeType,
          controlId: mapping.controlId,
          controlName: "",
          controlCode: "",
          description: mapping.description ?? "",
          collectedAt: mapping.collectedAt ?? new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          status: "error",
          errorMessage:
            uploadError instanceof Error ? uploadError.message : "Upload failed",
          fileHash,
        };
        appendSyncLog(entry);
        results.push(entry);
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({ results, successCount, errorCount, skippedCount });
  } catch (error) {
    console.error("Bulk import failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk import failed" },
      { status: 500 }
    );
  }
}
