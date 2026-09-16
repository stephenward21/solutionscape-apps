import { schedule, validate, type ScheduledTask } from "node-cron";
import type { BasicAIReport } from "../lib/types";

export interface SchedulerOptions {
  port: () => number;
  getApiKey: () => string | null;
  getCredentials: (provider: string) => unknown;
  onComplete: (report: BasicAIReport) => void;
  onError: (msg: string) => void;
}

export class Scheduler {
  private task: ScheduledTask | null = null;
  private opts: SchedulerOptions;
  private running = false;

  constructor(opts: SchedulerOptions) {
    this.opts = opts;
  }

  start(cronExpr: string): void {
    this.stop();
    if (!validate(cronExpr)) {
      this.opts.onError(`Invalid cron expression: ${cronExpr}`);
      return;
    }
    // node-cron v4: task starts automatically; timezone via options
    this.task = schedule(cronExpr, () => void this.runNow(), {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    console.log(`[Scheduler] started — ${cronExpr}`);
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  async runNow(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const base = `http://localhost:${this.opts.port()}`;
    const apiKey = this.opts.getApiKey();

    if (!apiKey) {
      this.opts.onError("Anthropic API key not saved. Open Settings to configure it.");
      this.running = false;
      return;
    }

    // Try each provider in turn until one returns users
    const providers = ["google", "microsoft", "okta"];
    let users: unknown[] = [];

    for (const provider of providers) {
      const creds = this.opts.getCredentials(provider);
      if (!creds) continue;

      try {
        const res = await fetch(`${base}/api/idp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, credentials: creds }),
        });
        if (res.ok) {
          const data = (await res.json()) as { users?: unknown[] };
          if (data.users && data.users.length > 0) {
            users = data.users;
            break;
          }
        }
      } catch (e) {
        console.error(`[Scheduler] IdP fetch failed (${provider}):`, e);
      }
    }

    if (users.length === 0) {
      this.opts.onError("No directory credentials saved or no users found. Open Settings to connect a provider.");
      this.running = false;
      return;
    }

    try {
      const res = await fetch(`${base}/api/basic-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const report = (await res.json()) as BasicAIReport;
      this.opts.onComplete(report);
    } catch (e) {
      this.opts.onError(`Scan failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }
}
