/**
 * AI Summarizer for MSP Dashboard
 *
 * Uses Claude to analyze a workspace's compliance posture and return a
 * prioritized list of action items. Results are cached for 6 hours in
 * data/snapshots/{workspaceId}-ai-summary.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataMonitoringTest,
  AISummaryResult,
  ActionItem,
  ActionPriority,
  ActionCategory,
} from "./types";
import { getControlStatus, getRiskSeverity } from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "snapshots");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function cacheFile(workspaceId: number): string {
  return path.join(CACHE_DIR, `${workspaceId}-ai-summary.json`);
}

function loadCache(workspaceId: number): AISummaryResult | null {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cacheFile(workspaceId);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as AISummaryResult;
    if (Date.now() - new Date(data.generatedAt).getTime() > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function saveCache(result: AISummaryResult): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(result.workspaceId), JSON.stringify(result, null, 2), "utf8");
}

function buildPrompt(
  workspaceName: string,
  controls: DrataControl[],
  tasks: DrataTask[],
  risks: DrataRisk[],
  tests: DrataMonitoringTest[]
): string {
  const failing = controls.filter((c) => getControlStatus(c) === "FAILING").slice(0, 20);
  const needsAttn = controls.filter((c) => getControlStatus(c) === "NEEDS_ATTENTION").slice(0, 20);
  const overdue = tasks.filter(
    (t) => t.status === "PAST_DUE" || (t.dueDate && new Date(t.dueDate) < new Date())
  ).slice(0, 15);
  const upcoming = tasks.filter(
    (t) =>
      t.status !== "COMPLETED" &&
      t.dueDate &&
      new Date(t.dueDate) >= new Date() &&
      new Date(t.dueDate) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  ).slice(0, 10);
  const activeRisks = risks
    .filter((r) => r.status === "ACTIVE")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 15);
  const failingTests = tests.filter((t) => t.checkResultStatus === "FAILED").slice(0, 15);

  return `You are a GRC expert advisor analyzing a client's compliance posture in Drata.
Client workspace: ${workspaceName}

## Failing Controls (${failing.length} shown)
${failing.length === 0 ? "None" : failing.map((c) => `- [${c.code ?? c.id}] ${c.name}${c.frameworkTags?.length ? ` (${c.frameworkTags.join(", ")})` : ""}`).join("\n")}

## Controls Needing Attention (${needsAttn.length} shown)
${needsAttn.length === 0 ? "None" : needsAttn.map((c) => `- [${c.code ?? c.id}] ${c.name}${c.flags ? ` (hasEvidence:${c.flags.hasEvidence ?? "?"}, hasOwner:${c.flags.hasOwner ?? "?"})` : ""}`).join("\n")}

## Overdue Tasks (${overdue.length})
${overdue.length === 0 ? "None" : overdue.map((t) => `- [Task ${t.id}] ${t.title} (due: ${t.dueDate ?? "unknown"})`).join("\n")}

## Tasks Due in Next 14 Days (${upcoming.length})
${upcoming.length === 0 ? "None" : upcoming.map((t) => `- [Task ${t.id}] ${t.title} (due: ${t.dueDate})`).join("\n")}

## Active Risks by Score (${activeRisks.length} shown)
${activeRisks.length === 0 ? "None" : activeRisks.map((r) => `- [Risk ${r.id}] ${r.title ?? "Untitled"} | ${getRiskSeverity(r)} | score: ${r.score ?? "?"}`).join("\n")}

## Failing Monitoring Tests (${failingTests.length})
${failingTests.length === 0 ? "None" : failingTests.map((t) => `- [Test ${t.id}] ${t.name ?? "Unnamed"}`).join("\n")}

---
Return a JSON object with EXACTLY this structure (no markdown fences):
{
  "summary": "<2-3 sentence executive summary of overall compliance health and top concerns>",
  "items": [
    {
      "id": "<unique string>",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "CONTROL" | "TASK" | "RISK" | "TEST",
      "title": "<short action title>",
      "description": "<what the problem is>",
      "reasoning": "<why this priority>",
      "suggestedAction": "<specific, actionable remediation step>",
      "relatedIds": ["<control code or task id>"]
    }
  ]
}
Rules: max 15 items, ordered by priority. Return ONLY valid JSON.`;
}

export async function getAISummary(
  workspaceId: number,
  workspaceName: string,
  controls: DrataControl[],
  tasks: DrataTask[],
  risks: DrataRisk[],
  tests: DrataMonitoringTest[],
  forceRefresh = false
): Promise<AISummaryResult> {
  if (!forceRefresh) {
    const cached = loadCache(workspaceId);
    if (cached) return cached;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = await (client.messages.create as (p: any) => Promise<Anthropic.Message>)({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: buildPrompt(workspaceName, controls, tasks, risks, tests) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  let parsed: { summary: string; items: (Omit<ActionItem, "id"> & { id?: string })[] };
  try {
    parsed = JSON.parse(textBlock.text) as typeof parsed;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${textBlock.text.slice(0, 200)}`);
  }

  const result: AISummaryResult = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    summary: parsed.summary ?? "",
    items: (parsed.items ?? []).map((item) => ({
      ...item,
      id: item.id ?? uuidv4(),
      priority: item.priority as ActionPriority,
      category: item.category as ActionCategory,
    })),
  };

  saveCache(result);
  return result;
}
