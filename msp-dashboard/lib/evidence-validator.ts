/**
 * Evidence Validator for MSP Dashboard
 *
 * New flow (replaces the broken evidence-library expand[]=versions approach):
 *
 * 1. Controls fetched with hasEvidence=true + expand[]=evidenceIds give us
 *    an evidenceIds object per control. We extract all unique version IDs.
 * 2. Each version ID is looked up via GET evidence-library/versions/{id},
 *    which returns { downloadUrl, mimeType, name, ... }.
 * 3. We download the file and send it to Claude alongside the list of controls
 *    that reference that evidence version.
 * 4. Claude returns per-control adequacy ratings.
 *
 * Cached in data/snapshots/{workspaceId}-evidence-validation.json
 * (no auto-expiry — user triggers explicitly via POST).
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import type {
  DrataControl,
  DrataEvidenceLibraryVersion,
  EvidenceValidationResult,
  EvidenceValidationItem,
  EvidenceControlValidation,
  EvidenceAdequacy,
} from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "snapshots");
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheFile(workspaceId: number): string {
  return path.join(CACHE_DIR, `${workspaceId}-evidence-validation.json`);
}

export function loadEvidenceCache(workspaceId: number): EvidenceValidationResult | null {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cacheFile(workspaceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as EvidenceValidationResult;
  } catch {
    return null;
  }
}

function saveEvidenceCache(result: EvidenceValidationResult): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(result.workspaceId), JSON.stringify(result, null, 2), "utf8");
}

// ─── Evidence ID extraction ───────────────────────────────────────────────────

/**
 * The evidenceIds property returned by expand[]=evidenceIds is an object whose
 * values are arrays of numeric IDs, e.g.:
 *   { "documentIds": [1, 2], "imageIds": [3] }
 * It may also be a flat number[] in some API versions.
 * This helper extracts all IDs regardless of shape.
 */
export function extractEvidenceIds(control: DrataControl): number[] {
  const raw = control.evidenceIds;
  if (!raw) return [];

  // Flat array case
  if (Array.isArray(raw)) {
    return raw.filter((x): x is number => typeof x === "number");
  }

  // Object case — iterate all values and collect numbers
  const ids: number[] = [];
  for (const val of Object.values(raw)) {
    if (Array.isArray(val)) {
      for (const id of val) {
        if (typeof id === "number") ids.push(id);
      }
    } else if (typeof val === "number") {
      ids.push(val);
    }
  }
  return ids;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function guessMediaType(url: string, contentType?: string | null): string {
  if (contentType) {
    const lower = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (lower && lower !== "application/octet-stream") return lower;
  }
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

function isSupported(mimeType: string): boolean {
  return ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"].includes(
    mimeType
  );
}

function isImageType(mimeType: string): mimeType is ImageMediaType {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType);
}

async function downloadFile(
  url: string,
  drataApiKey: string
): Promise<{ base64: string; mimeType: string; size: number } | null> {
  try {
    // Try without auth first (presigned URLs), retry with Bearer on 401/403
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
    return {
      type: "image",
      source: { type: "base64", media_type: mimeType, data: base64 },
    };
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
  controls: Array<{
    id: number;
    code?: string;
    name: string;
    description?: string;
    frameworkTags?: string[];
  }>
): string {
  const controlList = controls
    .map(
      (c) =>
        `- ID:${c.id} Code:${c.code ?? "N/A"} Name:"${c.name}"${
          c.description ? ` — ${c.description.slice(0, 150)}` : ""
        }${c.frameworkTags?.length ? ` [${c.frameworkTags.join(", ")}]` : ""}`
    )
    .join("\n");

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

/**
 * @param workspaceId       Drata workspace ID
 * @param drataApiKey       Used for Bearer-auth file downloads if presigned URL fails
 * @param controls          Controls returned by getControlsWithEvidence() — have .evidenceIds
 * @param evidenceVersionMap  Map of versionId → DrataEvidenceLibraryVersion (with downloadUrl)
 */
export async function validateEvidenceLibrary(
  workspaceId: number,
  drataApiKey: string,
  controls: DrataControl[],
  evidenceVersionMap: Map<number, DrataEvidenceLibraryVersion>
): Promise<EvidenceValidationResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const controlMap = new Map(controls.map((c) => [c.id, c]));

  // Build reverse map: versionId → controls that reference this evidence
  const versionToControls = new Map<number, DrataControl[]>();
  for (const ctrl of controls) {
    if (ctrl.archivedAt) continue;
    for (const vId of extractEvidenceIds(ctrl)) {
      const existing = versionToControls.get(vId) ?? [];
      existing.push(ctrl);
      versionToControls.set(vId, existing);
    }
  }

  const validationItems: EvidenceValidationItem[] = [];
  let validatedCount = 0;
  let skippedCount = 0;

  for (const versionId of Array.from(versionToControls.keys())) {
    const mappedControls: DrataControl[] = versionToControls.get(versionId) ?? [];
    const version = evidenceVersionMap.get(versionId);

    // Version lookup failed
    if (!version) {
      validationItems.push({
        evidenceId: versionId,
        evidenceName: `Evidence #${versionId}`,
        fileUrl: "",
        mimeType: "",
        fileDescription: "",
        controlValidations: [],
        skipped: true,
        skipReason: "Version details could not be retrieved from Drata",
      });
      skippedCount++;
      continue;
    }

    const displayName = version.evidenceName ?? version.name ?? `Evidence #${versionId}`;

    if (!version.downloadUrl) {
      validationItems.push({
        evidenceId: versionId,
        evidenceName: displayName,
        fileUrl: "",
        mimeType: version.mimeType ?? "",
        fileDescription: "",
        controlValidations: [],
        skipped: true,
        skipReason: "No download URL available",
      });
      skippedCount++;
      continue;
    }

    // Download the file
    const downloaded = await downloadFile(version.downloadUrl, drataApiKey);
    if (!downloaded) {
      const mimeType = version.mimeType ?? guessMediaType(version.downloadUrl, null);
      validationItems.push({
        evidenceId: versionId,
        evidenceName: displayName,
        fileUrl: version.downloadUrl,
        mimeType,
        fileDescription: "",
        controlValidations: [],
        skipped: true,
        skipReason: !isSupported(mimeType)
          ? `Unsupported file type: ${mimeType}`
          : "Download failed (may be expired or too large)",
      });
      skippedCount++;
      continue;
    }

    // Resolve full control details from the control map
    const resolvedControls = mappedControls
      .map((c) => controlMap.get(c.id) ?? c)
      .filter((c): c is DrataControl => !c.archivedAt);

    if (!resolvedControls.length) {
      skippedCount++;
      continue;
    }

    // Build Claude request
    const contentBlock = buildFileContentBlock(downloaded.base64, downloaded.mimeType);
    const prompt = buildValidationPrompt(
      displayName,
      downloaded.mimeType,
      resolvedControls.map((c) => ({
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
        thinking: { type: "adaptive" },
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: prompt }],
          },
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
      // Claude failed for this file — mark partial so user knows to review manually
      controlValidations = resolvedControls.map((c) => ({
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
      evidenceId: versionId,
      evidenceName: displayName,
      fileUrl: version.downloadUrl,
      mimeType: downloaded.mimeType,
      fileDescription,
      controlValidations,
    });
    validatedCount++;
  }

  // Aggregate adequacy counts across all control validations
  const allValidations = validationItems.flatMap((i) => i.controlValidations);
  const adequateCount = allValidations.filter((v) => v.adequacy === "ADEQUATE").length;
  const partialCount = allValidations.filter((v) => v.adequacy === "PARTIAL").length;
  const inadequateCount = allValidations.filter((v) => v.adequacy === "INADEQUATE").length;
  const unrelatedCount = allValidations.filter((v) => v.adequacy === "UNRELATED").length;

  const result: EvidenceValidationResult = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    totalEvidenceItems: versionToControls.size,
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

export { loadEvidenceCache as getCachedEvidenceValidation };
