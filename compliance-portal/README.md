# Compliance Portal

A **per-client, read-only compliance dashboard** that gives each of your Drata-managed clients a beautiful, shareable view of their compliance posture — with **AI-powered action item prioritization** driven by Claude.

## What it does

- **Single-click share links** — Generate a secure token-based URL for any client workspace. Clients don't need a Drata login.
- **Live compliance snapshot** — Framework health scores, control pass/fail/needs-attention breakdown, overdue tasks, open risks.
- **AI Priorities tab** — Claude (Opus 4.7) analyzes the client's failing controls, overdue tasks, and active risks, then returns a ranked, actionable list of what to fix first — with reasoning and specific remediation steps.
- **Controls, Tasks, Risks tabs** — Drill into the details with filtering and search.
- **Access controls** — Toggle risk register and control detail visibility per portal. Optional expiry dates. Optional `ADMIN_API_KEY` to protect link generation.

## Architecture

```
app/
  page.tsx                         # Admin panel — generate portal links
  portal/[token]/page.tsx          # Client-facing portal view
  api/
    generate-link/route.ts         # POST — create shareable token
    portal/[token]/
      snapshot/route.ts            # GET — compliance snapshot
      ai-priorities/route.ts       # GET — Claude AI prioritization (cached 6h)
      controls/route.ts            # GET — control list
      tasks/route.ts               # GET — open task list
      risks/route.ts               # GET — active risks

lib/
  drata-client.ts                  # Drata API v2 client
  types.ts                         # Shared types + status helpers
  portal-store.ts                  # Token → config persistence (gitignored)
  snapshot-builder.ts              # Builds PortalSnapshot from API data
  ai-prioritizer.ts                # Claude integration + 6h cache

data/
  portals/                         # ⚠️ gitignored — contains API keys
  ai-cache/                        # ⚠️ gitignored — contains AI responses
```

## Setup

```bash
cd compliance-portal
npm install
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY in .env.local
npm run dev     # starts on port 3002
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI prioritization |
| `ADMIN_API_KEY` | No | If set, `POST /api/generate-link` requires `x-admin-key: <value>` header |
| `NEXT_PUBLIC_BASE_URL` | No | Public URL for generated share links (default: `http://localhost:3002`) |

## Generating a portal link

**Via the web UI** — open `http://localhost:3002`, enter the client's Drata API key + a label, click **Generate Portal Link**. Copy the URL and share it with the client.

**Via API** — useful for automation / MSP tooling:

```bash
curl -X POST http://localhost:3002/api/generate-link \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "apiKey": "drata_...",
    "label": "Acme Corp",
    "expiresInDays": 30,
    "showRisks": true,
    "showControls": true
  }'
```

Response:
```json
{
  "token": "abc123...",
  "url": "http://localhost:3002/portal/abc123...",
  "label": "Acme Corp",
  "workspaceId": 42,
  "workspaceName": "Acme Primary",
  "expiresAt": "2026-07-09T..."
}
```

## Security notes

- **API keys are never committed** — `data/portals/` is gitignored; keys only live in `.env.local` (single tenant) or in the portal JSON files at runtime.
- Portal files store the Drata API key — **secure your server's filesystem accordingly**.
- For production, add auth middleware (e.g. Next.js middleware with session cookies) to protect the admin panel (`/`) and optionally add PIN protection per portal.

## AI prioritization

Claude reads the client's failing controls, overdue tasks, and active risks, then outputs a ranked action list with:

- **Priority** — CRITICAL / HIGH / MEDIUM / LOW
- **Category** — CONTROL / TASK / RISK / TEST
- **Description** — what the problem is
- **Reasoning** — why it's ranked at this level
- **Suggested Action** — specific remediation step

Results are **cached for 6 hours** in `data/ai-cache/{workspaceId}.json` to avoid re-calling Claude on every page load. Click **Refresh** in the UI to force a new analysis.
