/**
 * Monitoring Tests AI Prioritizer
 *
 * Claude analyzes a workspace's monitoring tests and returns a prioritized
 * list of failing/error tests ranked by compliance impact, control coverage,
 * and how long each test has been in a failing state.
 *
 * Cached 6 hours in data/snapshots/{workspaceId}-tests-ai.json.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  DrataMonitoringTest,
  TestsAISummaryResult,
  TestPriorityItem,
} from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "snapshots");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function cacheFile(workspaceId: number): string {
  return path.join(CACHE_DIR, `${workspaceId}-tests-ai.json`);
}

function loadCache(workspaceId: number): TestsAISummaryResult | null {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cacheFile(workspaceId);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as TestsAISummaryResult;
    if (Date.now() - new Date(data.generatedAt).getTime() > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(result: TestsAISummaryResult): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile(result.workspaceId), JSON.stringify(result, null, 2), "utf8");
}

function daysSince(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildPrompt(
  workspaceName: string,
  tests: DrataMonitoringTest[]
): string {
  const failing = tests.filter(
    (t) => t.checkResultStatus === "FAILED" || t.checkResultStatus === "ERROR"
  );
  const passing  = tests.filter((t) => t.checkResultStatus === "PASSED").length;
  const disabled = tests.filter(
    (t) => t.checkStatus === "DISABLED" || t.checkStatus === "UNUSED"
  ).length;

  const testLines = failing.map((t) => {
    const days = daysSince(t.failingSince ?? t.lastCheckedAt);
    const controls = (t.controls ?? []).map((c) => `${c.code} ${c.name}`).join(", ");
    return [
      `ID:${t.id} | Status:${t.checkResultStatus} | Name:"${t.name ?? "Unnamed"}"`,
      t.description ? `  Description: ${t.description.slice(0, 200)}` : null,
      t.sourceName  ? `  Service: ${t.sourceName}` : null,
      t.source      ? `  Source: ${t.source}` : null,
      t.failingSince ? `  Failing since: ${t.failingSince} (${days ?? "?"} days)` : null,
      t.lastCheckedAt && !t.failingSince ? `  Last checked: ${t.lastCheckedAt}` : null,
      controls ? `  Mapped controls: ${controls}` : "  Mapped controls: none",
      t.severity ? `  Severity: ${t.severity}` : null,
      t.remediationInstructions
        ? `  Remediation hint: ${t.remediationInstructions.slice(0, 150)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `You are a GRC expert advising an MSP on which monitoring test failures to prioritize for client workspace "${workspaceName}".

OVERALL PICTURE
- Total tests: ${tests.length}
- Passing: ${passing}
- Failing / Error: ${failing.length}
- Disabled / Unused: ${disabled}

FAILING / ERROR TESTS (all ${failing.length}):
${testLines.length === 0 ? "None — all tests passing." : testLines.join("\n\n")}

---
For each failing test, assess:
1. How many controls does it protect? More controls = higher impact.
2. How long has it been failing? Longer = more urgency.
3. What compliance frameworks does it affect (infer from control codes)?
4. Is there a quick or well-known fix (from the service name or remediation hint)?

Return ONLY valid JSON — no markdown, no extra text:
{
  "overallHealthSummary": "<2-3 sentence narrative of test health, top risk areas, and what the MSP should do first>",
  "priorityItems": [
    {
      "testId": <number — must match one of the IDs above>,
      "testName": "<exact name from above>",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "controlsAffected": [{ "code": "<code>", "name": "<name>" }],
      "reasoning": "<why this priority: control count, failure duration, framework impact>",
      "failingSince": "<ISO date string or null>",
      "suggestedAction": "<specific, actionable remediation step — not generic>",
      "estimatedImpact": "<one sentence on what fixing this unlocks compliance-wise>"
    }
  ]
}
Rules: include ALL failing/error tests, ordered by priority descending. Return ONLY valid JSON.`;
}

export async function getTestsAISummary(
  workspaceId: number,
  workspaceName: string,
  tests: DrataMonitoringTest[],
  forceRefresh = false
): Promise<TestsAISummaryResult> {
  if (!forceRefresh) {
    const cached = loadCache(workspaceId);
    if (cached) return cached;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey: anthropicKey });

  const failingCount = tests.filter((t) => t.checkResultStatus === "FAILED").length;
  const errorCount   = tests.filter((t) => t.checkResultStatus === "ERROR").length;

  // If nothing is failing, return a healthy summary without calling Claude
  if (failingCount === 0 && errorCount === 0) {
    const healthy: TestsAISummaryResult = {
      generatedAt: new Date().toISOString(),
      workspaceId,
      overallHealthSummary: `All ${tests.length} enabled monitoring tests are passing for ${workspaceName}. No immediate remediation required.`,
      failingCount: 0,
      errorCount: 0,
      priorityItems: [],
    };
    saveCache(healthy);
    return healthy;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = await (client.messages.create as (p: any) => Promise<Anthropic.Message>)({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: buildPrompt(workspaceName, tests) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  const rawText = textBlock.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: {
    overallHealthSummary: string;
    priorityItems: Array<{
      testId: number;
      testName: string;
      priority: TestPriorityItem["priority"];
      controlsAffected: Array<{ code: string; name: string }>;
      reasoning: string;
      failingSince?: string | null;
      suggestedAction: string;
      estimatedImpact: string;
    }>;
  };
  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${rawText.slice(0, 200)}`);
  }

  const result: TestsAISummaryResult = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    overallHealthSummary: parsed.overallHealthSummary ?? "",
    failingCount,
    errorCount,
    priorityItems: (parsed.priorityItems ?? []).map((item) => ({
      ...item,
      id: uuidv4(),
      failingSince: item.failingSince ?? undefined,
      controlsAffected: item.controlsAffected ?? [],
    })),
  };

  saveCache(result);
  return result;
}
