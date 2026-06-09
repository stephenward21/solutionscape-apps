/**
 * Claude Audit Readiness Validator
 *
 * Sends each uploaded evidence file to Claude along with the controls it's
 * mapped to. Claude assesses adequacy, identifies gaps, and recommends fixes.
 *
 * Supported file types:
 *   - Images (PNG, JPG, WEBP, GIF) → image content blocks
 *   - PDFs                          → document content blocks (base64)
 */
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type {
  UploadedFile,
  FileMapping,
  DrataControl,
  FileValidationResult,
  ControlValidation,
  ValidationReport,
  ControlGapSummary,
  Adequacy,
  Confidence,
  ReportStatus,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

function isImageType(mimeType: string): mimeType is ImageMediaType {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType);
}

function isPdfType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function buildFileContentBlock(file: UploadedFile): Anthropic.MessageParam["content"][number] {
  if (isImageType(file.mimeType)) {
    return {
      type: "image",
      source: { type: "base64", media_type: file.mimeType, data: file.base64 },
    };
  }
  if (isPdfType(file.mimeType)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: file.base64 },
    } as unknown as Anthropic.MessageParam["content"][number];
  }
  // Fallback: treat as plain text
  const text = Buffer.from(file.base64, "base64").toString("utf-8");
  return { type: "text", text: `[File: ${file.name}]\n${text}` };
}

function buildValidationPrompt(
  file: UploadedFile,
  controls: DrataControl[]
): string {
  const controlList = controls
    .map(
      (c) =>
        `- ID:${c.id} Code:${c.code ?? "N/A"} Name:"${c.name}"${
          c.description ? ` — ${c.description.slice(0, 200)}` : ""
        }${c.frameworkTags?.length ? ` [${c.frameworkTags.join(", ")}]` : ""}`
    )
    .join("\n");

  return `You are a GRC (Governance, Risk, and Compliance) auditor reviewing evidence files.

I'm providing you with a file named "${file.name}" (${file.mimeType}, ${Math.round(file.size / 1024)}KB).
This file has been mapped to the following compliance control(s):

${controlList}

Your task:
1. Describe what this evidence file contains / demonstrates (1-2 sentences).
2. For EACH control above, assess whether this file constitutes adequate evidence.

Return a JSON object with this exact structure:
{
  "fileDescription": "<1-2 sentence description of what the file shows>",
  "controlValidations": [
    {
      "controlId": <number>,
      "adequacy": "ADEQUATE" | "PARTIAL" | "INADEQUATE" | "UNRELATED",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "finding": "<what the evidence demonstrates relative to this control>",
      "gaps": ["<specific gap 1>", "<specific gap 2>"],
      "recommendation": "<concrete action to close the gaps>"
    }
  ]
}

Adequacy definitions:
- ADEQUATE: Evidence clearly and fully satisfies the control requirement
- PARTIAL: Evidence partially addresses the control but has gaps
- INADEQUATE: Evidence exists but does not satisfy the control requirement
- UNRELATED: Evidence has no relevance to this control

Return ONLY valid JSON, no markdown fences.`;
}

function buildExecutiveSummaryPrompt(
  workspaceName: string,
  fileResults: FileValidationResult[],
  coveredCount: number,
  uncoveredCount: number,
  total: number
): string {
  const adequacyCounts = { ADEQUATE: 0, PARTIAL: 0, INADEQUATE: 0, UNRELATED: 0 };
  fileResults.forEach((fr) =>
    fr.controlValidations.forEach((cv) => adequacyCounts[cv.adequacy]++)
  );

  return `You are a GRC audit advisor. Summarize the audit readiness assessment for ${workspaceName}.

Evidence coverage:
- ${coveredCount} of ${total} in-scope controls have evidence mapped (${uncoveredCount} have NO evidence)
- Across all evidence-to-control validations:
  - ADEQUATE: ${adequacyCounts.ADEQUATE}
  - PARTIAL: ${adequacyCounts.PARTIAL}
  - INADEQUATE: ${adequacyCounts.INADEQUATE}
  - UNRELATED: ${adequacyCounts.UNRELATED}

Files reviewed: ${fileResults.length}
File summaries:
${fileResults.map((fr) => `- ${fr.fileName}: ${fr.fileDescription}`).join("\n")}

Write a 3-4 sentence executive summary for a client-facing audit readiness report. Be direct about the current state, highlight the biggest gaps, and give a clear overall assessment. Return plain text only (no JSON, no markdown).`;
}

// ─── Main validator ───────────────────────────────────────────────────────────

export async function validateEvidence(
  apiKey: string,
  workspaceId: number,
  workspaceName: string,
  files: UploadedFile[],
  mappings: FileMapping[],
  allControls: DrataControl[]
): Promise<ValidationReport> {
  const anthropic = new Anthropic({ apiKey });

  const controlMap = new Map<number, DrataControl>();
  allControls.forEach((c) => controlMap.set(c.id, c));

  // ── Step 1: Validate each file against its mapped controls ────────────────
  const fileResults: FileValidationResult[] = [];

  for (const mapping of mappings) {
    const file = files.find((f) => f.id === mapping.fileId);
    if (!file) continue;

    const mappedControls = mapping.controlIds
      .map((id) => controlMap.get(id))
      .filter((c): c is DrataControl => c !== undefined);

    if (!mappedControls.length) continue;

    const contentBlock = buildFileContentBlock(file);
    const prompt = buildValidationPrompt(file, mappedControls);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await (anthropic.messages.create as (p: any) => Promise<Anthropic.Message>)({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") continue;

    let parsed: {
      fileDescription: string;
      controlValidations: Array<{
        controlId: number;
        adequacy: Adequacy;
        confidence: Confidence;
        finding: string;
        gaps: string[];
        recommendation: string;
      }>;
    };

    try {
      parsed = JSON.parse(textBlock.text) as typeof parsed;
    } catch {
      // If JSON parse fails, create a minimal result
      parsed = {
        fileDescription: `File: ${file.name}`,
        controlValidations: mappedControls.map((c) => ({
          controlId: c.id,
          adequacy: "PARTIAL" as Adequacy,
          confidence: "LOW" as Confidence,
          finding: "Could not parse Claude response",
          gaps: ["Manual review required"],
          recommendation: "Review this file manually against the control",
        })),
      };
    }

    const controlValidations: ControlValidation[] = (parsed.controlValidations ?? []).map((cv) => {
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

    fileResults.push({
      fileId: file.id,
      fileName: file.name,
      fileDescription: parsed.fileDescription ?? "",
      controlValidations,
    });
  }

  // ── Step 2: Aggregate per-control gap summary ─────────────────────────────
  const controlGapMap = new Map<
    number,
    { adequacies: Adequacy[]; gaps: Set<string>; ctrl: DrataControl }
  >();

  fileResults.forEach((fr) => {
    fr.controlValidations.forEach((cv) => {
      const existing = controlGapMap.get(cv.controlId);
      if (existing) {
        existing.adequacies.push(cv.adequacy);
        cv.gaps.forEach((g) => existing.gaps.add(g));
      } else {
        const ctrl = controlMap.get(cv.controlId);
        if (ctrl) {
          controlGapMap.set(cv.controlId, {
            adequacies: [cv.adequacy],
            gaps: new Set(cv.gaps),
            ctrl,
          });
        }
      }
    });
  });

  const ADEQUACY_RANK: Record<Adequacy, number> = {
    ADEQUATE: 3,
    PARTIAL: 2,
    INADEQUATE: 1,
    UNRELATED: 0,
  };

  const controlGaps: ControlGapSummary[] = Array.from(controlGapMap.entries()).map(
    ([id, { adequacies, gaps, ctrl }]) => {
      const bestAdequacy = adequacies.reduce<Adequacy>((best, cur) => {
        return ADEQUACY_RANK[cur] > ADEQUACY_RANK[best] ? cur : best;
      }, "UNRELATED");

      return {
        controlId: id,
        controlCode: ctrl.code ?? String(id),
        controlName: ctrl.name,
        frameworkTags: ctrl.frameworkTags ?? [],
        bestAdequacy,
        mappedFileCount: adequacies.length,
        gaps: Array.from(gaps),
      };
    }
  );

  const coveredControlIds = new Set(controlGapMap.keys());
  const inScopeControls = allControls.filter((c) => !c.archivedAt);
  const coveredControlCount = coveredControlIds.size;
  const uncoveredControlCount = inScopeControls.filter((c) => !coveredControlIds.has(c.id)).length;
  const totalInScopeControls = inScopeControls.length;

  // ── Step 3: Executive summary via Claude ──────────────────────────────────
  let executiveSummary = "";
  try {
    const summaryMsg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: buildExecutiveSummaryPrompt(
            workspaceName,
            fileResults,
            coveredControlCount,
            uncoveredControlCount,
            totalInScopeControls
          ),
        },
      ],
    });
    const block = summaryMsg.content.find((b) => b.type === "text");
    if (block?.type === "text") executiveSummary = block.text;
  } catch {
    executiveSummary = `Validated ${fileResults.length} evidence file(s) against ${coveredControlCount} controls. ${uncoveredControlCount} controls have no evidence mapped.`;
  }

  // ── Step 4: Overall status ────────────────────────────────────────────────
  const adequateCount = controlGaps.filter((g) => g.bestAdequacy === "ADEQUATE").length;
  const coverageRatio = totalInScopeControls > 0 ? coveredControlCount / totalInScopeControls : 0;
  const adequacyRatio = coveredControlCount > 0 ? adequateCount / coveredControlCount : 0;

  let overallStatus: ReportStatus = "NOT_READY";
  if (coverageRatio >= 0.8 && adequacyRatio >= 0.8) overallStatus = "AUDIT_READY";
  else if (coverageRatio >= 0.5 && adequacyRatio >= 0.5) overallStatus = "NEEDS_WORK";

  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    workspaceId,
    workspaceName,
    fileResults,
    controlGaps,
    coveredControlCount,
    uncoveredControlCount,
    totalInScopeControls,
    overallStatus,
    executiveSummary,
  };
}
