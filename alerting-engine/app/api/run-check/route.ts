/**
 * POST /api/run-check
 *
 * Manually triggers an alert rule check (or all rules if no id given).
 * Also used as the target for a cron job / external scheduler.
 *
 * Body: { ruleId?: string }
 */
import { NextResponse } from "next/server";
import { listRules, loadRule } from "@/lib/rule-store";
import { runRule } from "@/lib/alert-engine";
import type { AlertEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: { ruleId?: string } = {};
  try { body = (await req.json()) as typeof body; } catch { /* no body */ }

  const rules = body.ruleId
    ? [loadRule(body.ruleId)].filter((r): r is NonNullable<typeof r> => r !== null)
    : listRules().filter((r) => r.enabled);

  if (!rules.length) {
    return NextResponse.json({ message: "No rules to run", events: [] });
  }

  const results: { ruleId: string; ruleName: string; events: AlertEvent[]; error?: string }[] = [];

  for (const rule of rules) {
    try {
      const events = await runRule(rule);
      results.push({ ruleId: rule.id, ruleName: rule.name, events });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ruleId: rule.id, ruleName: rule.name, events: [], error: message });
    }
  }

  const totalFired = results.reduce((sum, r) => sum + r.events.length, 0);
  return NextResponse.json({ ran: rules.length, alertsFired: totalFired, results });
}
