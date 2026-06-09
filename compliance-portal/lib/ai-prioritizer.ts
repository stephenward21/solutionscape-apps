/**
 * AI Prioritizer — uses Claude to analyze a client's compliance posture and
 * generate a ranked list of action items with remediation guidance.
 *
 * Results are cached in data/ai-cache/{workspaceId}.json for 6 hours to avoid
 * re-running Claude on every page load.
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
  ActionItem,
  AIPrioritiesResult,
} from "./types";
import { getControlStatus, getRiskSeverity } from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "ai-cache");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cacheKey(workspaceId: number): string {
  return path.join(CACHE_DIR, `${workspaceId}.json`);
}

function loadCache(workspaceId: number): AIPrioritiesResult | null {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cacheKey(workspaceId);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as AIPrioritiesResult;
    const age = Date.now() - new Date(data.generatedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(result: AIPrioritiesResult): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheKey(result.workspaceId), JSON.stringify(result, null, 2), "utf8");
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

interface PrioritizerInput {
  workspaceId: number;
  workspaceName: string;
  controls: DrataControl[];
  tasks: DrataTask[];
  risks: DrataRisk[];
  tests: DrataMonitoringTest[];
}

function buildPrompt(input: PrioritizerInput): string {
  const failingControls = input.controls
    .filter((c) => getControlStatus(c) === "FAILING")
    .slice(0, 20);

  const attentionControls = input.controls
    .filter((c) => getControlStatus(c) === "NEEDS_ATTENTION")
    .slice(0, 20);

  const overdueTasks = input.tasks
    .filter((t) => t.status === "PAST_DUE" || (t.dueDate && new Date(t.dueDate) < new Date()))
    .slice(0, 15);

  const upcomingTasks = input.tasks
    .filter(
      (t) =>
        t.status !== "COMPLETED" &&
        t.dueDate &&
        new Date(t.dueDate) >= new Date() &&
        new Date(t.dueDate) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    )
    .slice(0, 10);

  const activeRisks = input.risks
    .filter((r) => r.status === "ACTIVE")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 15);

  const failingTests = input.tests
    .filter((t) => t.checkResultStatus === "FAILED")
    .slice(0, 15);

  return `You are a GRC (Governance, Risk, and Compliance) expert advisor analyzing a client's compliance posture in Drata.

Client workspace: ${input.workspaceName}

Here is the current compliance data:

## Failing Controls (automated checks failing — ${failingControls.length} shown)
${
  failingControls.length === 0
    ? "None"
    : failingControls
        .map(
          (c) =>
            `- [${c.code ?? c.id}] ${c.name}${
              c.frameworkTags?.length ? ` (${c.frameworkTags.join(", ")})` : ""
            }`
        )
        .join("\n")
}

## Controls Needing Attention (not monitored/not ready — ${attentionControls.length} shown)
${
  attentionControls.length === 0
    ? "None"
    : attentionControls
        .map(
          (c) =>
            `- [${c.code ?? c.id}] ${c.name}${
              c.flags
                ? ` (hasEvidence:${c.flags.hasEvidence ?? "?"}, hasOwner:${c.flags.hasOwner ?? "?"}, hasPolicy:${c.flags.hasPolicy ?? "?"})`
                : ""
            }`
        )
        .join("\n")
}

## Overdue Tasks (${overdueTasks.length})
${
  overdueTasks.length === 0
    ? "None"
    : overdueTasks
        .map(
          (t) =>
            `- [Task ${t.id}] ${t.title} (due: ${t.dueDate ?? "unknown"}, assigned: ${
              t.assignee
                ? `${t.assignee.firstName ?? ""} ${t.assignee.lastName ?? ""}`.trim() ||
                  t.assignee.email
                : "unassigned"
            })`
        )
        .join("\n")
}

## Tasks Due in Next 14 Days (${upcomingTasks.length})
${
  upcomingTasks.length === 0
    ? "None"
    : upcomingTasks
        .map((t) => `- [Task ${t.id}] ${t.title} (due: ${t.dueDate})`)
        .join("\n")
}

## Active Risks by Score (${activeRisks.length} shown, highest first)
${
  activeRisks.length === 0
    ? "None"
    : activeRisks
        .map(
          (r) =>
            `- [Risk ${r.id}] ${r.title ?? "Untitled"} | severity: ${getRiskSeverity(r)} | score: ${r.score ?? "?"} | treatment: ${r.treatmentPlan ?? "none"}`
        )
        .join("\n")
}

## Failing Monitoring Tests (${failingTests.length} shown)
${
  failingTests.length === 0
    ? "None"
    : failingTests
        .map((t) => `- [Test ${t.id}] ${t.name ?? "Unnamed"} (last checked: ${t.lastCheckedAt ?? "unknown"})`)
        .join("\n")
}

---

Based on this data, generate a prioritized list of ACTION ITEMS the client should address to improve their compliance posture.

Return a JSON object with this exact structure:
{
  "summary": "<2-3 sentence executive summary of the overall compliance health and top concerns>",
  "items": [
    {
      "id": "<unique string>",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "CONTROL" | "TASK" | "RISK" | "TEST",
      "title": "<short action title>",
      "description": "<what the problem is>",
      "reasoning": "<why this is prioritized at this level>",
      "suggestedAction": "<specific, actionable remediation step>",
      "relatedIds": ["<control code or task id etc>"]
    }
  ]
}

Rules:
- Maximum 15 action items total
- Prioritize by: CRITICAL risks/failing controls with no owner → HIGH overdue tasks / failing monitored controls → MEDIUM upcoming tasks / unowned controls → LOW general hygiene
- Focus on the most impactful gaps first
- suggestedAction should be specific and actionable, not generic
- Return ONLY valid JSON, no markdown fences`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getAIPriorities(
  input: PrioritizerInput,
  forceRefresh = false
): Promise<AIPrioritiesResult> {
  // Check cache first
  if (!forceRefresh) {
    const cached = loadCache(input.workspaceId);
    if (cached) return cached;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = await (client.messages.create as (params: any) => Promise<Anthropic.Message>)({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  // Extract the text content block
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let parsed: { summary: string; items: (Omit<ActionItem, "id"> & { id?: string })[] };
  try {
    parsed = JSON.parse(textBlock.text) as typeof parsed;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${textBlock.text.slice(0, 200)}`);
  }

  const result: AIPrioritiesResult = {
    generatedAt: new Date().toISOString(),
    workspaceId: input.workspaceId,
    summary: parsed.summary ?? "",
    items: (parsed.items ?? []).map((item) => ({
      ...item,
      id: item.id ?? uuidv4(),
    })),
  };

  saveCache(result);
  return result;
}
