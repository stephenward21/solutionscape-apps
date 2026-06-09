# Alerting Engine

A **real-time compliance alerting engine** that monitors Drata workspaces for compliance events and dispatches notifications to **Slack**, **Jira**, **email**, and **custom webhooks**. Uses state-diffing to detect *new* issues rather than re-alerting on existing ones.

## What it does

- **Alert Rules** — define which workspace to monitor, which events to watch, and where to send notifications
- **State diffing** — on each check, compares current state to the previous snapshot to find *newly* failing controls, newly overdue tasks, newly opened risks, etc.
- **Multi-channel dispatch** — single rule can fire to Slack + Jira + webhook simultaneously
- **Manual & scheduled** — run checks on demand from the UI, or trigger via cron/scheduler hitting `POST /api/run-check`
- **Event history** — full log of every alert fired with delivery status per channel
- **Test channels** — validate Slack webhooks, Jira auth, and webhook endpoints before saving rules

## Alert Triggers

| Trigger | Description |
|---|---|
| New Failing Control | A control transitions from passing → failing (automated check FAILED) |
| New Overdue Task | A compliance task passes its due date |
| Critical Risk Opened | An active risk with score ≥ 20 appears for the first time |
| High Risk Opened | An active risk with score 12–19 appears for the first time |
| Failing Monitoring Test | An automated monitoring test flips to FAILED |
| Control Without Owner | A control has no assigned owner |
| Daily Digest | Summary of current compliance state (fires on every check) |

## Notification Channels

| Channel | What's needed |
|---|---|
| **Slack** | Incoming Webhook URL (+ optional channel override) |
| **Jira** | Base URL, project key, user email, API token |
| **Email** | Recipient address(es) — SMTP configured via env or external service |
| **Webhook** | Any HTTPS endpoint; optional Bearer token + custom headers |

## Architecture

```
app/
  page.tsx                       # Dashboard UI
  api/
    alert-rules/route.ts         # CRUD for alert rules (GET/POST/PATCH/DELETE)
    run-check/route.ts           # POST — trigger checks for all/one rule
    history/route.ts             # GET — event history
    channels/route.ts            # POST — test a channel config

components/
  AlertingDashboard.tsx          # Main dashboard (stats, tabs, run-all button)
  RuleList.tsx                   # Rule cards with enable/disable/delete/run
  CreateRuleModal.tsx            # 3-step rule creation wizard
  EventHistory.tsx               # Alert event log with delivery status

lib/
  drata-client.ts                # Drata API v2 client
  types.ts                       # Shared types
  alert-engine.ts                # State diffing + channel dispatch
  rule-store.ts                  # Rule persistence + check state snapshots
  history-store.ts               # Event log (last 500 events)

data/
  rules/                         # ⚠️ gitignored — contains Drata API keys
  history/                       # ⚠️ gitignored — state snapshots + event log
```

## Setup

```bash
cd alerting-engine
npm install
cp .env.example .env.local
npm run dev     # starts on port 3004
```

No environment variables are required to run — the Drata API key is stored per rule in `data/rules/` (gitignored). All channel credentials (Slack webhook URL, Jira API token, etc.) are also stored per-rule and gitignored.

## Running checks on a schedule

The `/api/run-check` endpoint is designed to be called by an external scheduler:

```bash
# Every 15 minutes via cron
*/15 * * * * curl -s -X POST http://localhost:3004/api/run-check \
  -H "Content-Type: application/json" -d '{}'
```

Or trigger a single rule:
```bash
curl -X POST http://localhost:3004/api/run-check \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "your-rule-uuid"}'
```

Response includes how many rules ran and how many alerts fired.

## State diffing

Each time a check runs, the engine:
1. Fetches current controls, tasks, risks, and monitoring tests from Drata
2. Loads the previous check state from `data/history/state-{workspaceId}.json`
3. Identifies **newly** problematic items (items in current state but NOT in previous state)
4. Fires one alert per new issue
5. Saves the new state as the baseline for next time

This means if a control is already failing when you first set up a rule, you won't get a flood of historical alerts — only truly new transitions trigger notifications.

## Security notes

- Rule files in `data/rules/` contain Drata API keys and channel credentials — **gitignored**, never committed
- For production: add auth middleware to protect the dashboard, and consider encrypting stored API keys
- Jira API tokens and Slack webhook URLs are stored in plain text in the rule JSON — secure your server's filesystem accordingly
