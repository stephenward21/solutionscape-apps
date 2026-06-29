/**
 * POST /api/analyze-policy
 * Accepts a PDF or Word policy file, extracts text, and sends it to Claude
 * to identify which AI tools/vendors are approved, prohibited, or conditional.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type { PolicyAnalysisResult, AIToolPolicy } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text fallback
  return buffer.toString("utf8");
}

function buildPrompt(policyText: string, filename: string): string {
  return `You are an AI governance expert. Analyze the following AI usage policy document and extract structured information about which AI tools, agents, and vendors are in scope.

Policy filename: ${filename}

POLICY TEXT:
${policyText.slice(0, 30000)}

---

Analyze this policy and return ONLY valid JSON in this exact structure:

{
  "organizationName": "<organization name if mentioned, else null>",
  "summary": "<2-3 sentence plain-English summary of the policy's overall stance on AI tool usage>",
  "approvedTools": [
    {
      "tool": "<tool name e.g. GitHub Copilot>",
      "vendor": "<vendor e.g. GitHub/Microsoft>",
      "status": "APPROVED",
      "conditions": null,
      "categories": ["code-generation"],
      "reasoning": "<why you classified it as approved>"
    }
  ],
  "prohibitedTools": [
    {
      "tool": "<tool name>",
      "vendor": "<vendor>",
      "status": "PROHIBITED",
      "conditions": null,
      "categories": ["llm", "general-purpose"],
      "reasoning": "<why prohibited>"
    }
  ],
  "conditionalTools": [
    {
      "tool": "<tool name>",
      "vendor": "<vendor>",
      "status": "CONDITIONAL",
      "conditions": "<specific conditions for allowed use>",
      "categories": [],
      "reasoning": "<why conditional>"
    }
  ],
  "unreviewedCategories": ["<category not addressed by policy e.g. image-generation, voice-AI, code-review-AI>"],
  "policyGaps": ["<specific gap in the policy e.g. 'No guidance on AI tools for HR functions'", ...]
}

Rules:
- Only include tools/vendors explicitly mentioned or clearly implied by the policy
- If the policy broadly prohibits a category (e.g. 'no external LLMs'), list that as a prohibited category entry
- Infer common AI tools from category language (e.g. 'no generative AI' implies ChatGPT, Claude, Gemini are prohibited)
- policyGaps should flag missing coverage areas an organization should address
- Return ONLY valid JSON, no markdown fences`;
}

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large — maximum 20 MB" }, { status: 400 });
  }

  let policyText: string;
  try {
    policyText = await extractText(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to read file: ${msg}` }, { status: 400 });
  }

  if (!policyText.trim()) {
    return NextResponse.json({ error: "Could not extract text from the uploaded file" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callClaude = (params: any) =>
    (client.messages.create as (p: any) => Promise<Anthropic.Message>)(params);

  try {
    const baseParams = {
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: buildPrompt(policyText, file.name) }],
    };

    let message: Anthropic.Message;
    try {
      message = await callClaude(baseParams);
    } catch (firstErr) {
      // Retry without thinking on Anthropic 5xx — large inputs with adaptive thinking
      // can trigger internal server errors; standard mode handles the same task fine.
      const isServerError = firstErr instanceof Anthropic.InternalServerError;
      if (!isServerError) throw firstErr;
      message = await callClaude({ ...baseParams, thinking: undefined });
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: {
      organizationName?: string | null;
      summary: string;
      approvedTools: AIToolPolicy[];
      prohibitedTools: AIToolPolicy[];
      conditionalTools: AIToolPolicy[];
      unreviewedCategories: string[];
      policyGaps: string[];
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 300)}`);
    }

    const result: PolicyAnalysisResult = {
      id: uuidv4(),
      policyFilename: file.name,
      analyzedAt: new Date().toISOString(),
      organizationName: parsed.organizationName ?? undefined,
      summary: parsed.summary ?? "",
      approvedTools: parsed.approvedTools ?? [],
      prohibitedTools: parsed.prohibitedTools ?? [],
      conditionalTools: parsed.conditionalTools ?? [],
      unreviewedCategories: parsed.unreviewedCategories ?? [],
      policyGaps: parsed.policyGaps ?? [],
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
