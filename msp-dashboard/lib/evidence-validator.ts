/**
 * Evidence Validator for MSP Dashboard
 *
 * Fetches evidence items from Drata's Evidence Library (with expand[]=versions),
 * downloads the actual file from each item's latest version `source` URL,
 * then asks Claude to validate whether that file is relevant and adequate
 * evidence for the mapped controls.
 *
 * Cached in data/snapshots/{workspaceId}-evidence-validation.json
 * (no auto-expiry — user triggers explicitly or on first load).
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import type {
  DrataEvidenceItem,
  DrataControl,
  EvidenceValidationResult,
  EvidenceValidationItem,
  EvidenceControlValidation,
  EvidenceAdequacy,
} from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "snapshots");
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per file

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

function cacheFile(workspaceId: number): string {
  return path.join(CACHE_DIR, `${workspaceId}-evidence-validation.json`);
}

export function loadEvidenceCache(workspaceId: number): EvidenceValidationResult | null {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cacheFile(workspaceId);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as EvidenceValidationResult; }
  catch { return null; }
}

function saveEvidenceCache(result: EvidenceValidationResult): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(result.workspaceId), JSON.stringify(result, null, 2), "utf8");
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function guessMediaType(url: string, contentType?: string | null): string {
  if (contentType) {
    const lower = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (lower) return lower;
  }
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

function isSupported(mimeType: string): boolean {
  return ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]
    .includes(mimeType);
}

function isImageType(mimeType: string): mimeType is ImageMediaType {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType);
}

async function downloadFile(
  url: string,
  drataApiKey: string
): Promise<{ base64: string; mimeType: string; size: number } | null> {
  try {
    // Try first without auth (presigned URLs), then with Bearer if 403/401
    let res = await fetch(url, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      res = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${drataApiKey}` },
      });
    }
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type");
    const mimeType = guessMediaType(url, contentType);
    if (!isSupported(mimeType)) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) return null;

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { base64, mimeType, size: arrayBuffer.byteLength };
  } catch {
    return null;
  }
}

// ─── Claude content blocks ────────────────────────────────────────────────────

function buildFileContentBlock(
  base64: string,
  mimeType: string
): Anthropic.MessageParam["content"][number] {
  if (isImageType(mimeType)) {
    return { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };
  }
  // PDF
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf" as const, data: base64 },
  } as unknown as Anthropic.MessageParam["content"][number];
}

function buildValidationPrompt(
  evidenceName: string,
  mimeType: string,
  controls: Array<{ id: number; code?: string; name: string; description?: string; frameworkTags?: string[] }>
): string {
  const controlList = controls.map(
    (c) =>
      `- ID:${c.id} Code:${c.code ?? "N/A"} Name:"${c.name}"${
        c.description ? ` — ${c.description.slice(0, 150)}` : ""
      }${c.frameworkTags?.length ? ` [${c.frameworkTags.join(", ")}]` : ""}`
  ).join("\n");

  return `You are a GRC auditor reviewing compliance evidence files.

Evidence file: "${evidenceName}" (${mimeType})
This file is mapped to the following control(s):
${controlList}

For each control listed:
1. Describe what the evidence file demonstrates (1-2 sentences overall at the top).
2. Assess adequacy: ADEQUATE (fully satisfies), PARTIAL (partially addresses), INADEQUATE (doesn't satisfy), UNRELATED (no relevance).
3. Identify specific gaps if any.
4. Provide a concrete remediation recommendation.

Return ONLY valid JSON (no markdown fences):
{
  "fileDescription": "<1-2 sentence description of what this file shows>",
  "controlValidations": [
    {
      "controlId": <number>,
      "adequacy": "ADEQUATE" | "PARTIAL" | "INADEQUATE" | "UNRELATED",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "finding": "<what this evidence demonstrates for this control>",
      "gaps": ["<specific gap>"],
      "recommendation": "<concrete action to close gaps>"
    }
  ]
}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function validateEvidenceLibrary(
  workspaceId: number,
  drataApiKey: string,
  evidenceItems: DrataEvidenceItem[],
  allControls: DrataControl[]
): Promise<EvidenceValidationResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const controlMap = new Map(allControls.map((c) => [c.id, c]));

  const validationItems: EvidenceValidationItem[] = [];
  let validatedCount = 0;
  let skippedCount = 0;

  // Only process items that have at least one control mapped AND have a source URL
  const processable = evidenceItems.filter(
    (e) => !e.archivedAt && e.controls && e.controls.length > 0 && e.versions && e.versions.length > 0
  );

  for (const item of processable) {
    // Get the latest version (sort by createdAt desc, fallback to first)
    const latestVersion = [...(item.versions ?? [])]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      [0];

    if (!latestVersion?.source) {
      validationItems.push({
        evidenceId: item.id,
        evidenceName: item.name,
        fileUrl: "",
        mimeType: "",
        fileDescription: "",
        controlValidations: [],
        skipped: true,
        skipReason: "No source URL available",
      });
      skippedCount++;
      continue;
    }

    // Download the file
    const downloaded = await downloadFile(latestVersion.source, drataApiKey);
    if (!downloaded) {
      const mimeType = latestVersion.mimeType ?? guessMediaType(latestVersion.source, null);
      validationItems.push({
        evidenceId: item.id,
        evidenceName: item.name,
        fileUrl: latestVersion.source,
        mimeType,
        fileDescription: "",
        controlValidations: [],
        skipped: true,
        skipReason: !isSupported(mimeType)
          ? `Unsupported file type: ${mimeType}`
          : `Download failed (may be expired or too large)`,
      });
      skippedCount++;
      continue;
    }

    // Resolve the mapped controls
    const mappedControls = (item.controls ?? [])
      .map((c) => controlMap.get(c.id))
      .filter((c): c is DrataControl => c !== undefined);

    if (!mappedControls.length) {
      skippedCount++;
      continue;
    }

    // Build Claude request
    const contentBlock = buildFileContentBlock(downloaded.base64, downloaded.mimeType);
    const prompt = buildValidationPrompt(
      item.name,
      downloaded.mimeType,
      mappedControls.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        frameworkTags: c.frameworkTags,
      }))
    );

    let fileDescription = "";
    let controlValidations: EvidenceControlValidation[] = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = await (anthropic.messages.create as (p: any) => Promise<Anthropic.Message>)({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        messages: [
          { role: "user", content: [contentBlock, { type: "text", text: prompt }] },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock?.type === "text") {
        const parsed = JSON.parse(textBlock.text) as {
          fileDescription: string;
          controlValidations: Array<{
            controlId: number;
            adequacy: EvidenceAdequacy;
            confidence: "HIGH" | "MEDIUM" | "LOW";
            finding: string;
            gaps: string[];
            recommendation: string;
          }>;
        };

        fileDescription = parsed.fileDescription ?? "";
        controlValidations = (parsed.controlValidations ?? []).map((cv) => {
          const ctrl = controlMap.get(cv.controlId);
          return {
            controlId: cv.controlId,
            controlCode: ctrl?.code ?? String(cv.controlId),
            controlName: ctrl?.name ?? "Unknown",
            frameworkTags: ctrl?.frameworkTags ?? [],
            adequacy: cv.adequacy,
            confidence: cv.confidence,
            finding: cv.finding,
            gaps: cv.gaps ?? [],
            recommendation: cv.recommendation,
          };
        });
      }
    } catch {
      // If Claude fails for this file, mark it partially
      controlValidations = mappedControls.map((c) => ({
        controlId: c.id,
        controlCode: c.code ?? String(c.id),
        controlName: c.name,
        frameworkTags: c.frameworkTags ?? [],
        adequacy: "PARTIAL" as EvidenceAdequacy,
        confidence: "LOW" as const,
        finding: "Analysis failed — manual review required",
        gaps: ["Unable to automatically analyze this file"],
        recommendation: "Review this file manually against the control requirements",
      }));
    }

    validationItems.push({
      evidenceId: item.id,
      evidenceName: item.name,
      fileUrl: latestVersion.source,
      mimeType: downloaded.mimeType,
      fileDescription,
      controlValidations,
    });
    validatedCount++;
  }

  // Aggregate adequacy counts
  const allValidations = validationItems.flatMap((i) => i.controlValidations);
  const adequateCount = allValidations.filter((v) => v.adequacy === "ADEQUATE").length;
  const partialCount = allValidations.filter((v) => v.adequacy === "PARTIAL").length;
  const inadequateCount = allValidations.filter((v) => v.adequacy === "INADEQUATE").length;
  const unrelatedCount = allValidations.filter((v) => v.adequacy === "UNRELATED").length;

  const result: EvidenceValidationResult = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    totalEvidenceItems: evidenceItems.filter((e) => !e.archivedAt).length,
    validatedCount,
    skippedCount,
    adequateCount,
    partialCount,
    inadequateCount,
    unrelatedCount,
    items: validationItems,
  };

  saveEvidenceCache(result);
  return result;
}

// Helper: just return cache if it exists, don't re-run
export { loadEvidenceCache as getCachedEvidenceValidation };
