# MSP Compliance Dashboard

A single-pane-of-glass internal dashboard for a GRC MSP to monitor all client Drata workspaces at once. Shows per-client compliance health scores, failing controls, overdue tasks, upcoming deadlines, open risks, and a 30-day trend sparkline. Supports drill-down into any client for a full breakdown.

## What It Does

- **Overview grid**: All client workspaces on one page, each showing their RAG status (green/amber/red), framework health bars, overall compliance score, 30-day sparkline trend, and quick-glance stats.
- **Drill-down**: Click any workspace card to see the full breakdown: framework health, all controls (filterable and sortable), overdue/upcoming tasks, risks by severity, and a recent events timeline.
- **Snapshot caching**: Data is cached on-disk per workspace (15-minute TTL). The dashboard loads from cache immediately and refreshes stale data in the background. Force-refresh any individual workspace with the ↻ button.
- **Graceful degradation**: If one workspace's Drata API call fails, its card shows an error state with a retry button — other workspaces still load normally.

## Prerequisites

- Node.js 18 or higher
- Drata API key(s) with read permissions for:
  - Frameworks
  - Controls
  - Tasks
  - Risks
  - Monitoring Tests
  - Events

## Setup

```bash
# 1. Clone/navigate to the app
cd msp-dashboard

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Drata API key(s) — see configuration below

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Single Workspace

```env
DRATA_API_KEY=your_api_key_here
```

### Multiple Workspaces (Multi-Tenant)

```env
DRATA_TENANTS=[{"name":"Client A","apiKey":"key_abc"},{"name":"Client B","apiKey":"key_xyz"}]
```

Each workspace appears as a separate card on the dashboard. Workspace names are used as display labels and in URL paths.

## Snapshot Caching

Snapshots are stored as JSON files in `data/snapshots/` (one file per workspace, named by slugified workspace name). This directory is gitignored.

- **TTL**: 15 minutes. After expiry, the next `/api/snapshots` request fetches fresh data.
- **Force-refresh**: The ↻ button on each card calls `/api/client/[workspace]/snapshot` which always fetches fresh regardless of cache age.
- **History**: Each snapshot save appends a daily data point to a 30-point rolling history, used to render the sparkline.
- **Deployment note**: The snapshot store uses the local filesystem. On platforms with ephemeral filesystems (Vercel, Railway with no persistent storage), snapshots will not persist between deploys/restarts. For persistent caching in production, replace `lib/snapshot-store.ts` with a database-backed implementation.

## RAG Scoring Thresholds

| Status | Score | Meaning |
|--------|-------|---------|
| Green (Healthy) | ≥ 90% | Controls largely passing |
| Amber (Needs Attention) | ≥ 70% | Some controls failing or needing attention |
| Red (At Risk) | < 70% | Significant compliance gaps |

The overall score is a weighted average across all frameworks, where the weight is the number of applicable controls in each framework. Only non-`NOT_APPLICABLE` controls are counted.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## Project Structure

```
msp-dashboard/
├── app/
│   ├── api/
│   │   ├── snapshots/route.ts              # GET all workspace snapshots
│   │   └── client/[workspace]/
│   │       ├── snapshot/route.ts           # Force-refresh single workspace
│   │       ├── controls/route.ts           # Controls list with filters
│   │       ├── tasks/route.ts              # Tasks with overdue/upcoming split
│   │       ├── risks/route.ts              # Risks list with filters
│   │       └── events/route.ts             # Recent activity
│   ├── client/[workspace]/page.tsx         # Client detail page
│   ├── page.tsx                            # Dashboard home page
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Dashboard.tsx                       # Main client component (card grid)
│   ├── WorkspaceCard.tsx                   # Individual workspace card
│   ├── ClientDetail.tsx                    # Full drill-down view (tabbed)
│   ├── ControlsTable.tsx                   # Sortable/filterable controls table
│   ├── TasksTable.tsx                      # Tasks with due date formatting
│   ├── RisksTable.tsx                      # Risks sorted by severity
│   ├── EventsLog.tsx                       # Timeline-style events list
│   ├── FrameworkBar.tsx                    # Tricolor progress bar per framework
│   ├── RAGBadge.tsx                        # Green/amber/red status badge
│   ├── Sparkline.tsx                       # Pure-SVG 30-day trend line
│   └── StatsRow.tsx                        # Failing/overdue/risk counts
├── lib/
│   ├── drata-client.ts                     # DrataClient class + workspace helpers
│   ├── snapshot-store.ts                   # Disk-based snapshot cache
│   ├── health-calculator.ts                # RAG scoring, framework health logic
│   ├── build-snapshot.ts                   # Orchestrates a full snapshot fetch
│   └── types.ts                            # Shared TypeScript types
└── data/snapshots/                         # Gitignored runtime cache files
```

## Deployment Note

This app uses the local filesystem to cache snapshots (`data/snapshots/`). On platforms with ephemeral or read-only filesystems (e.g., Vercel serverless), snapshot files will not persist between function invocations. In that case:

1. The dashboard will still work — it will fetch fresh data from Drata on every load.
2. The 30-day history/sparkline will not accumulate over time.

For production use with persistent history, replace the `saveSnapshot`/`loadSnapshot` functions in `lib/snapshot-store.ts` with a database adapter (e.g., Postgres, Redis, or a hosted JSON store).
