# Evidence Sync

A web application for uploading compliance evidence files (screenshots, PDFs, exports) directly into Drata's Evidence Library, mapped to specific controls. Supports multiple client workspaces, drag-and-drop uploads, bulk CSV imports, and a persistent sync history log.

---

## What It Does

Select a client workspace and compliance framework, browse or search controls, then drag and drop evidence files directly onto a control. The app uploads each file to Drata's Evidence Library with your description and collection date, detects duplicates automatically, and logs every upload for future reference.

Key capabilities:

- **Multi-workspace** — manage multiple client Drata accounts from one interface
- **Control browser** — browse controls by framework (SOC 2, ISO 27001, HIPAA, etc.) with live search and status indicators
- **Drag-and-drop upload** — drop PNG, JPG, PDF, DOCX, XLSX, CSV, or ZIP files onto a selected control
- **Metadata tagging** — set description and collection date per upload
- **Duplicate detection** — SHA-256 file hashing skips re-uploading identical files to the same control
- **Bulk import** — upload a CSV mapping file with a ZIP of evidence files for batch processing
- **Existing evidence viewer** — see what's already uploaded for any control, with the ability to delete stale records
- **Sync log** — persistent history of every upload (success, error, or skipped) across all workspaces

---

## Prerequisites

- **Node.js 18+** — [download here](https://nodejs.org/)
- **Drata API key(s)** — generate from your Drata workspace under **Settings → API**
  - Requires a key with Evidence Library read/write permissions

---

## Setup & Installation

### 1. Clone the repo

```bash
git clone https://github.com/stephenward21/solutionscape-apps.git
cd solutionscape-apps/evidence-sync
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure credentials

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Drata credentials. Choose one of the two modes:

**Single workspace:**
```
DRATA_API_KEY=your_drata_api_key_here
```

**Multiple workspaces (MSP mode):**
```
DRATA_TENANTS=[{"name":"Client A","apiKey":"key_abc"},{"name":"Client B","apiKey":"key_xyz"}]
```

In multi-workspace mode, a workspace selector appears at the top of the app. API keys are never exposed in the browser.

### 4. Start the app

```bash
npm run dev
```

Navigate to **[http://localhost:3000](http://localhost:3000)**

---

## Usage

### Uploading Evidence

1. **Select workspace** — choose the client account from the top dropdown (single-workspace setups show "Default")
2. **Select framework** — click a framework tab (SOC 2, ISO 27001, HIPAA, etc.)
3. **Find a control** — browse the list or use the search bar; controls show a status indicator (green = passing, red = failing, yellow = needs attention)
4. **Drop files** — drag files into the upload zone, or click **Browse files**; supported types: PNG, JPG, GIF, WEBP, PDF, DOCX, XLSX, CSV, ZIP
5. **Add metadata** — enter a description and set the collection date (defaults to today)
6. **Upload** — click **↑ Upload Files**; each file shows individual progress and a success/error/skipped badge
7. **Existing evidence** — the panel below the upload zone shows files already uploaded for the selected control, with a delete button to remove stale records

### Duplicate Detection

Before uploading, each file is hashed (SHA-256) and compared against the existing evidence for that control. If an identical file has already been uploaded, it is skipped and logged as `skipped` — no duplicate records are created in Drata.

### Bulk Import

For uploading many files across multiple controls at once:

1. Click **⚡ Bulk Import** in the top toolbar
2. Click **Download CSV Template** to get a pre-formatted template with headers:

   | Column | Required | Description |
   |---|---|---|
   | `fileName` | ✅ | Must match the filename inside the ZIP |
   | `controlId` | ✅ | Drata numeric control ID |
   | `description` | — | Optional evidence description |
   | `collectedAt` | — | ISO date (YYYY-MM-DD); defaults to today |

3. Fill in the CSV and collect all evidence files into a single ZIP
4. Upload the CSV and ZIP together and click **Import**
5. Results show per-file: success, error (with message), or skipped (duplicate)

### Sync Log

Every upload attempt is recorded in the sync log panel at the bottom of the screen:

| Icon | Meaning |
|---|---|
| ✅ | Successfully uploaded to Drata |
| ❌ | Upload failed — error message shown |
| ⏭ | Skipped — identical file already exists for this control |

The log persists between sessions (stored locally in `data/sync-logs/`). Click **Clear Log** to reset it.

---

## Multi-Workspace / MSP Mode

When `DRATA_TENANTS` is set, the workspace picker at the top of the app lets you switch between client accounts. Each workspace uses its own API key, stored entirely server-side — the browser never sees a key.

The sync log records the workspace name with every entry so you have a full cross-client upload history.

---

## Project Structure

```
evidence-sync/
├── app/
│   ├── api/
│   │   ├── workspaces/route.ts       # GET — list configured workspace names
│   │   ├── frameworks/route.ts       # GET — list Drata frameworks for a workspace
│   │   ├── controls/route.ts         # GET — controls with optional framework + search filters
│   │   ├── evidence/
│   │   │   ├── route.ts              # GET list evidence, POST upload single file
│   │   │   ├── [id]/route.ts         # DELETE a specific evidence record
│   │   │   └── bulk/route.ts         # POST bulk import via CSV + ZIP
│   │   └── sync-log/route.ts         # GET persistent upload history
│   ├── page.tsx                      # Server component — reads env config, passes to client
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── EvidenceSync.tsx              # Main client component — layout and state
│   ├── WorkspacePicker.tsx           # Workspace dropdown
│   ├── ControlBrowser.tsx            # Framework tabs + searchable control list
│   ├── DropZone.tsx                  # Drag-and-drop file area + staged file list
│   ├── MetadataForm.tsx              # Description and date fields
│   ├── BulkImport.tsx                # Slide-over panel for CSV + ZIP bulk upload
│   └── SyncLogPanel.tsx              # Upload history panel
├── lib/
│   ├── drata-client.ts               # DrataClient class — all Drata API calls
│   ├── sync-log-store.ts             # File-based sync log (data/sync-logs/)
│   ├── file-utils.ts                 # SHA-256 hashing, MIME detection, size formatting
│   └── types.ts                      # Shared TypeScript interfaces
├── data/
│   └── sync-logs/                    # Gitignored — persists between sessions
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript type checking without building |

---

## Deployment

The app runs anywhere Next.js is supported — Vercel, a Node.js server, Docker.

**Required environment variable:**
```
DRATA_API_KEY=...
# or
DRATA_TENANTS=[{...}]
```

**Note on sync log persistence:** The sync log is stored in `data/sync-logs/` on the local filesystem. In serverless environments (Vercel, etc.) the filesystem is ephemeral — logs will not persist across deployments. For persistent history in serverless environments, the log store would need to be backed by a database or object storage (the `lib/sync-log-store.ts` interface is designed to make this swap straightforward).

---

## Supported File Types

| Type | Extensions |
|---|---|
| Images (screenshots) | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |
| Documents | `.pdf`, `.docx` |
| Spreadsheets | `.xlsx`, `.csv` |
| Archives | `.zip` |

---

## Help Resources

- [Drata Evidence Library Help](https://help.drata.com)
- [Drata API Reference](https://developers.drata.com/openapi/reference/v2/overview/)
- [Drata Custom Connections Overview](https://help.drata.com/en/articles/8913174-custom-connections)
