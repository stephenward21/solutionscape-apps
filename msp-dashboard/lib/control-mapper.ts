/**
 * Control Mapper
 *
 * Downloads files from Google Drive, OneDrive, Google Docs/Sheets/Slides,
 * or any direct HTTPS URL. Extracts zip archives automatically. Then sends
 * each file to Claude with the workspace's full control list, and Claude
 * recommends which controls the file provides evidence for.
 *
 * Supported source types:
 *   - Google Drive file share links  (drive.google.com/file/d/...)
 *   - Google Docs / Sheets / Slides  (docs.google.com/document|spreadsheets|presentation)
 *   - OneDrive personal share links  (1drv.ms / onedrive.live.com)
 *   - OneDrive for Business          (sharepoint.com)
 *   - Direct HTTPS download URLs
 *
 * Supported file types sent to Claude:
 *   - PDF, PNG, JPEG, GIF, WEBP (native vision/document blocks)
 *   - Plain text / Markdown / CSV / JSON / XML (text block)
 *   - DOCX (converted to text via mammoth)
 *   - XLSX / XLS (converted to CSV text via SheetJS)
 *
 * Zip files are extracted and each entry is analyzed individually.
 */

import Anthropic from "@anthropic-ai/sdk";
import AdmZip from "adm-zip";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type {
  DrataControl,
  ControlMappingResult,
  ControlMappingFileResult,
  RecommendedControlMapping,
} from "./types";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_FILES_FROM_ZIP = 20;
const MAX_CONTROLS_IN_PROMPT = 300;

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

interface DownloadedFile {
  name: string;
  buffer: Buffer;
  mimeType: string;
}

// ─── URL detection ────────────────────────────────────────────────────────────

type UrlKind =
  | "google-drive-file"
  | "google-docs"
  | "google-sheets"
  | "google-slides"
  | "google-drive-folder"
  | "onedrive"
  | "direct";

function detectUrlKind(url: string): UrlKind {
  if (url.includes("docs.google.com/document")) return "google-docs";
  if (url.includes("docs.google.com/spreadsheets")) return "google-sheets";
  if (url.includes("docs.google.com/presentation")) return "google-slides";
  if (url.includes("drive.google.com")) {
    return url.includes("/folders/") ? "google-drive-folder" : "google-drive-file";
  }
  if (
    url.includes("1drv.ms") ||
    url.includes("onedrive.live.com") ||
    url.includes("sharepoint.com") ||
    url.includes("my.sharepoint.com")
  ) {
    return "onedrive";
  }
  return "direct";
}

export function describeUrlKind(url: string): string {
  switch (detectUrlKind(url)) {
    case "google-drive-file": return "Google Drive file";
    case "google-docs":       return "Google Doc";
    case "google-sheets":     return "Google Sheet";
    case "google-slides":     return "Google Slides";
    case "google-drive-folder": return "Google Drive folder";
    case "onedrive":          return "OneDrive file";
    default:                  return "Direct URL";
  }
}

function extractGoogleId(url: string): string | null {
  // /file/d/{id}/... or /document/d/{id}/... etc.
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];
  // open?id={id}
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch?.[1] ?? null;
}

// ─── Downloaders ──────────────────────────────────────────────────────────────

async function fetchWithFallback(
  urls: string[]
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  for (const url of urls) {
    try {
      let res = await fetch(url, { redirect: "follow", cache: "no-store" });

      // Google Drive may return an HTML virus-scan warning for large files
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/html") && url.includes("drive.google.com")) {
        const html = await res.text();
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        if (!confirmMatch) continue;
        res = await fetch(
          `${url}&confirm=${confirmMatch[1]}`,
          { redirect: "follow", cache: "no-store" }
        );
      }

      if (!res.ok) continue;

      const finalCt = res.headers.get("content-type") ?? "application/octet-stream";
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_FILE_BYTES) continue;

      const disposition = res.headers.get("content-disposition") ?? "";
      const nameMatch = disposition.match(/filename[*]?=["']?([^"';\r\n]+)/i);
      const urlName = url.split("?")[0]?.split("/").pop() ?? "file";
      const filename = nameMatch?.[1]?.trim().replace(/^UTF-8''/, "") ?? urlName;

      return { buffer: buf, mimeType: finalCt.split(";")[0]?.trim() ?? "application/octet-stream", filename };
    } catch {
      continue;
    }
  }
  return null;
}

async function downloadGoogleDriveFile(
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  return fetchWithFallback([
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
  ]);
}

async function downloadGoogleDoc(
  fileId: string,
  kind: "google-docs" | "google-sheets" | "google-slides"
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  const exportUrls: Record<string, string> = {
    "google-docs":   `https://docs.google.com/document/d/${fileId}/export?format=pdf`,
    "google-sheets": `https://docs.google.com/spreadsheets/d/${fileId}/export?format=pdf`,
    "google-slides": `https://docs.google.com/presentation/d/${fileId}/export/pdf`,
  };
  const result = await fetchWithFallback([exportUrls[kind] ?? ""]);
  if (!result) return null;
  // Force PDF mime type since that's what we're exporting
  return { ...result, mimeType: "application/pdf", filename: `${fileId}.pdf` };
}

async function downloadOneDrive(
  shareUrl: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  // Microsoft Graph anonymous share API
  const base64 = Buffer.from(shareUrl).toString("base64url");
  return fetchWithFallback([
    `https://api.onedrive.com/v1.0/shares/u!${base64}/root/content`,
    // Fallback: try appending download=1 to the original URL
    shareUrl.includes("?") ? `${shareUrl}&download=1` : `${shareUrl}?download=1`,
  ]);
}

// ─── Zip extraction ───────────────────────────────────────────────────────────

function isZip(buf: Buffer, mimeType: string, filename: string): boolean {
  // Check by mime type, extension, or magic bytes (PK signature)
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    filename.toLowerCase().endsWith(".zip")
  ) return true;
  // PK magic bytes: 0x50 0x4B
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function extractZip(buf: Buffer): DownloadedFile[] {
  try {
    const zip = new AdmZip(buf);
    return zip
      .getEntries()
      .filter(
        (e) =>
          !e.isDirectory &&
          !e.entryName.startsWith("__MACOSX") &&
          !e.name.startsWith(".")
      )
      .slice(0, MAX_FILES_FROM_ZIP)
      .map((e) => ({
        name: e.entryName,
        buffer: e.getData(),
        mimeType: guessMimeFromName(e.name),
      }))
      .filter((f) => f.buffer.length > 0 && f.buffer.length <= MAX_FILE_BYTES);
  } catch {
    return [];
  }
}

// ─── MIME helpers ─────────────────────────────────────────────────────────────

const EXT_MIME: Record<string, string> = {
  pdf:      "application/pdf",
  png:      "image/png",
  jpg:      "image/jpeg",
  jpeg:     "image/jpeg",
  gif:      "image/gif",
  webp:     "image/webp",
  txt:      "text/plain",
  md:       "text/plain",
  markdown: "text/plain",
  csv:      "text/csv",
  json:     "application/json",
  xml:      "application/xml",
  html:     "text/html",
  htm:      "text/html",
  log:      "text/plain",
  docx:     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx:     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls:      "application/vnd.ms-excel",
};

function guessMimeFromName(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

function normalizeMime(mimeType: string, filename: string): string {
  // Server sometimes returns generic octet-stream — try to improve from filename
  if (mimeType === "application/octet-stream") {
    const guessed = guessMimeFromName(filename);
    if (guessed !== "application/octet-stream") return guessed;
  }
  return mimeType;
}

function isImageMime(mime: string): mime is ImageMediaType {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime);
}

function isTextMime(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml"
  );
}

function isDocxMime(mime: string): boolean {
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isSpreadsheetMime(mime: string): boolean {
  return (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  );
}

function isClaudeSupported(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    isImageMime(mime) ||
    isTextMime(mime) ||
    isDocxMime(mime) ||
    isSpreadsheetMime(mime)
  );
}

// ─── Office document converters ───────────────────────────────────────────────

async function convertDocxToText(buffer: Buffer): Promise<string | null> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim() || null;
  } catch {
    return null;
  }
}

function convertSpreadsheetToText(buffer: Buffer): string | null {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) parts.push(`[Sheet: ${sheetName}]\n${csv}`);
    }
    return parts.length ? parts.join("\n\n") : null;
  } catch {
    return null;
  }
}

// ─── Claude content block ─────────────────────────────────────────────────────

function buildContentBlock(
  file: DownloadedFile
): Anthropic.MessageParam["content"][number] | null {
  const mime = file.mimeType;

  if (isImageMime(mime)) {
    return {
      type: "image",
      source: { type: "base64", media_type: mime, data: file.buffer.toString("base64") },
    };
  }
  if (mime === "application/pdf") {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf" as const,
        data: file.buffer.toString("base64"),
      },
    } as unknown as Anthropic.MessageParam["content"][number];
  }
  if (isTextMime(mime)) {
    // Truncate very large text files so we don't blow the token budget
    const text = file.buffer.toString("utf-8").slice(0, 60_000);
    return { type: "text", text: `[File: ${file.name}]\n\n${text}` };
  }
  return null;
}

// ─── Control list for prompt ──────────────────────────────────────────────────

function buildControlList(controls: DrataControl[]): string {
  return controls
    .filter((c) => !c.archivedAt)
    .slice(0, MAX_CONTROLS_IN_PROMPT)
    .map(
      (c) =>
        `ID:${c.id} | ${c.code ?? "N/A"} | ${c.name}` +
        (c.description ? ` — ${c.description.slice(0, 120)}` : "") +
        (c.frameworkTags?.length ? ` [${c.frameworkTags.join(", ")}]` : "")
    )
    .join("\n");
}

// ─── Shared analysis engine ───────────────────────────────────────────────────

async function analyzeFiles(
  workspaceId: number,
  sourceLabel: string,
  filesToAnalyze: DownloadedFile[],
  controls: DrataControl[]
): Promise<ControlMappingResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const controlMap = new Map(controls.map((c) => [c.id, c]));
  const controlList = buildControlList(controls);

  const fileResults: ControlMappingFileResult[] = [];
  let analyzedCount = 0;
  let skippedCount = 0;

  for (const rawFile of filesToAnalyze) {
    if (!isClaudeSupported(rawFile.mimeType)) {
      fileResults.push({
        fileName: rawFile.name,
        mimeType: rawFile.mimeType,
        size: rawFile.buffer.length,
        fileDescription: "",
        recommendedControls: [],
        skipped: true,
        skipReason: `Unsupported file type (${rawFile.mimeType}) — supported: PDF, images, text, CSV, DOCX, XLSX`,
      });
      skippedCount++;
      continue;
    }

    // Convert Office documents to plain text so Claude can read them
    let file = rawFile;
    if (isDocxMime(rawFile.mimeType)) {
      const text = await convertDocxToText(rawFile.buffer);
      if (!text) {
        fileResults.push({
          fileName: rawFile.name, mimeType: rawFile.mimeType, size: rawFile.buffer.length,
          fileDescription: "", recommendedControls: [], skipped: true,
          skipReason: "Could not extract text from DOCX — file may be corrupt or password-protected",
        });
        skippedCount++;
        continue;
      }
      file = { ...rawFile, buffer: Buffer.from(text, "utf-8"), mimeType: "text/plain" };
    } else if (isSpreadsheetMime(rawFile.mimeType)) {
      const text = convertSpreadsheetToText(rawFile.buffer);
      if (!text) {
        fileResults.push({
          fileName: rawFile.name, mimeType: rawFile.mimeType, size: rawFile.buffer.length,
          fileDescription: "", recommendedControls: [], skipped: true,
          skipReason: "Could not extract data from spreadsheet — file may be corrupt or password-protected",
        });
        skippedCount++;
        continue;
      }
      file = { ...rawFile, buffer: Buffer.from(text, "utf-8"), mimeType: "text/plain" };
    }

    const contentBlock = buildContentBlock(file);
    if (!contentBlock) {
      fileResults.push({
        fileName: rawFile.name,
        mimeType: rawFile.mimeType,
        size: rawFile.buffer.length,
        fileDescription: "",
        recommendedControls: [],
        skipped: true,
        skipReason: "Could not build content block for this file",
      });
      skippedCount++;
      continue;
    }

    const prompt = `You are a GRC expert helping an MSP map client evidence files to compliance controls.

Analyze the attached file and recommend which of the following Drata controls it provides evidence for.

AVAILABLE CONTROLS (format: ID | Code | Name — Description [Frameworks]):
${controlList}

INSTRUCTIONS:
1. Describe what this file is and what compliance-relevant content it contains (2-3 sentences).
2. Identify the TOP 10 most relevant controls this file provides evidence for. Focus on HIGH confidence matches first.
3. For each control: explain specifically what aspect of the file satisfies the control, and note the exact section/content that supports it.
4. Confidence levels:
   - HIGH: file directly and explicitly addresses the control requirement
   - MEDIUM: file partially addresses it or covers a related sub-requirement
   - LOW: file is tangentially relevant but would only partially count as evidence

Return ONLY valid JSON (no markdown fences):
{
  "fileDescription": "<2-3 sentence description of what this file is and what compliance evidence it contains>",
  "recommendedControls": [
    {
      "controlId": <number matching one of the IDs above>,
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "reasoning": "<why this file maps to this control and what requirement it satisfies>",
      "evidenceNote": "<the specific section, data, or content in the file that supports this control>"
    }
  ]
}`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = await (anthropic.messages.create as (p: any) => Promise<Anthropic.Message>)({
        model: "claude-opus-4-7",
        max_tokens: 3000,
        thinking: { type: "adaptive" },
        messages: [
          { role: "user", content: [contentBlock, { type: "text", text: prompt }] },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("No text block in response");

      // Strip accidental markdown fences before parsing
      const rawText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      const parsed = JSON.parse(rawText) as {
        fileDescription: string;
        recommendedControls: Array<{
          controlId: number;
          confidence: "HIGH" | "MEDIUM" | "LOW";
          reasoning: string;
          evidenceNote: string;
        }>;
      };

      const recommendedControls: RecommendedControlMapping[] = (
        parsed.recommendedControls ?? []
      )
        .map((rc) => {
          const ctrl = controlMap.get(rc.controlId);
          if (!ctrl) return null;
          return {
            controlId: ctrl.id,
            controlCode: ctrl.code ?? String(ctrl.id),
            controlName: ctrl.name,
            frameworkTags: ctrl.frameworkTags ?? [],
            confidence: rc.confidence,
            reasoning: rc.reasoning,
            evidenceNote: rc.evidenceNote,
          } satisfies RecommendedControlMapping;
        })
        .filter((rc): rc is RecommendedControlMapping => rc !== null);

      fileResults.push({
        fileName: rawFile.name,
        mimeType: rawFile.mimeType,
        size: rawFile.buffer.length,
        fileDescription: parsed.fileDescription ?? "",
        recommendedControls,
      });
      analyzedCount++;
    } catch (err) {
      fileResults.push({
        fileName: rawFile.name,
        mimeType: rawFile.mimeType,
        size: rawFile.buffer.length,
        fileDescription: "",
        recommendedControls: [],
        skipped: true,
        skipReason:
          err instanceof SyntaxError
            ? "Claude returned unexpected output — try again"
            : "Analysis failed — try again",
      });
      skippedCount++;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    workspaceId,
    sourceUrl: sourceLabel,
    totalFiles: filesToAnalyze.length,
    analyzedCount,
    skippedCount,
    files: fileResults,
  };
}

// ─── Public: from URL ─────────────────────────────────────────────────────────

export async function mapFilesFromUrl(
  workspaceId: number,
  sourceUrl: string,
  controls: DrataControl[]
): Promise<ControlMappingResult> {
  const kind = detectUrlKind(sourceUrl);

  if (kind === "google-drive-folder") {
    throw new Error(
      "Google Drive folders cannot be downloaded directly. " +
        "Zip the folder, share the zip, and paste that link instead."
    );
  }

  let primary: { buffer: Buffer; mimeType: string; filename: string } | null = null;

  if (kind === "google-drive-file") {
    const id = extractGoogleId(sourceUrl);
    if (!id) throw new Error("Could not extract file ID from Google Drive URL.");
    primary = await downloadGoogleDriveFile(id);
  } else if (kind === "google-docs" || kind === "google-sheets" || kind === "google-slides") {
    const id = extractGoogleId(sourceUrl);
    if (!id) throw new Error("Could not extract document ID from Google URL.");
    primary = await downloadGoogleDoc(id, kind);
  } else if (kind === "onedrive") {
    primary = await downloadOneDrive(sourceUrl);
  } else {
    primary = await fetchWithFallback([sourceUrl]);
  }

  if (!primary) {
    throw new Error(
      'Could not download the file. Ensure sharing is set to "Anyone with the link can view" and try again.'
    );
  }

  primary.mimeType = normalizeMime(primary.mimeType, primary.filename);

  const filesToAnalyze = resolveFiles(primary.buffer, primary.mimeType, primary.filename);
  return analyzeFiles(workspaceId, sourceUrl, filesToAnalyze, controls);
}

// ─── Public: from uploaded buffer ────────────────────────────────────────────

export async function mapFilesFromBuffer(
  workspaceId: number,
  filename: string,
  buffer: Buffer,
  mimeType: string,
  controls: DrataControl[]
): Promise<ControlMappingResult> {
  const normalizedMime = normalizeMime(mimeType, filename);
  const filesToAnalyze = resolveFiles(buffer, normalizedMime, filename);
  return analyzeFiles(workspaceId, `upload:${filename}`, filesToAnalyze, controls);
}

// ─── Shared: zip expansion or single-file passthrough ────────────────────────

function resolveFiles(
  buffer: Buffer,
  mimeType: string,
  filename: string
): DownloadedFile[] {
  if (isZip(buffer, mimeType, filename)) {
    const extracted = extractZip(buffer);
    if (!extracted.length) {
      throw new Error("The zip file appears to be empty or could not be extracted.");
    }
    return extracted;
  }
  return [{ name: filename, buffer, mimeType }];
}

// Keep old name as alias so existing route import still compiles
export { mapFilesFromUrl as mapFilesToControls };
