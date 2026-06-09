# Audit Readiness Validator

An **AI-powered evidence validation tool** that reads your actual compliance evidence files (screenshots, PDFs) and validates them against your Drata controls using Claude. It tells you what's adequate, what's partial, what's missing, and exactly how to close each gap.

## What it does

1. **Connect to Drata** — enter your API key, pick a workspace, and the app loads all in-scope controls
2. **Upload evidence files** — drag and drop screenshots (PNG/JPG/GIF/WEBP) and PDFs (up to 20MB each)
3. **Map to controls** — assign each file to one or more Drata controls; filter by framework or search by name/code
4. **AI Validation** — Claude (Opus 4.7) reads each file and assesses adequacy against each mapped control:
   - **ADEQUATE** — evidence fully satisfies the control
   - **PARTIAL** — evidence partially addresses the control; gaps identified
   - **INADEQUATE** — evidence doesn't satisfy the control requirement
   - **UNRELATED** — evidence has no relevance to the control
5. **Audit Readiness Report** — get an executive summary, evidence coverage %, adequacy %, per-file results, and a prioritized gap list. Download as JSON.

## Architecture

```
app/
  page.tsx                       # Main validator UI (4-step wizard)
  api/
    workspaces/route.ts          # GET workspaces from Drata API
    controls/route.ts            # GET active controls for a workspace
    validate/route.ts            # POST — run Claude validation
    report/route.ts              # GET saved reports

components/
  ValidatorApp.tsx               # Step wizard orchestrator
  SetupStep.tsx                  # API key + workspace selection
  UploadStep.tsx                 # Drag/drop file upload
  MappingStep.tsx                # Map files to controls
  ValidationReport.tsx           # Report display (summary, files, gaps tabs)

lib/
  drata-client.ts                # Drata API v2 client
  types.ts                       # Shared types
  claude-validator.ts            # Claude evidence analysis engine
  report-store.ts                # Save/load reports (data/reports/ — gitignored)

data/
  reports/                       # ⚠️ gitignored — contains validation reports
  uploads/                       # ⚠️ gitignored — not used at runtime (base64 in memory)
```

## Setup

```bash
cd audit-validator
npm install
cp .env.example .env.local
# Add ANTHROPIC_API_KEY to .env.local
npm run dev     # starts on port 3003
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for evidence validation |

## How Claude validates evidence

For each file + control pair, Claude receives:
- The actual file content (image or PDF, base64-encoded)
- The control code, name, description, and framework tags

Claude returns:
- **What the file demonstrates** (1-2 sentence description)
- **Adequacy rating** per control
- **Confidence level** (HIGH / MEDIUM / LOW)
- **Finding** — what the evidence shows relative to the control
- **Gaps** — specific deficiencies identified
- **Recommendation** — concrete remediation step

After all files are validated, a second Claude call generates an executive summary with an overall audit readiness assessment.

## Supported file types

| Type | Extension | Notes |
|---|---|---|
| PNG image | `.png` | Screenshots, diagrams |
| JPEG image | `.jpg`, `.jpeg` | Photos, exports |
| GIF image | `.gif` | Animated or static |
| WEBP image | `.webp` | Web screenshots |
| PDF document | `.pdf` | Policies, reports, audit logs |

Max file size: **20MB per file**

## Security notes

- Drata API keys are never stored — used only for the current session (in-memory)
- Evidence files are processed in-memory and never written to disk
- Validation reports are saved to `data/reports/` (gitignored)
- For production, add authentication before deploying this tool to a shared server
