# SolutionScape AI Governance — Electron Desktop App

This document covers running and packaging the app as a native desktop application.
The web/Node setup (`npm run dev` / `npm start`) is unchanged and continues to work alongside the Electron setup.

---

## Two ways to run

| Mode | Command | Use case |
|---|---|---|
| **Web (Node)** | `npm run dev` | Browser at `http://localhost:3005` — no Electron, no credential storage, no scheduling |
| **Desktop (Electron)** | `npm run electron:dev` | Full desktop app with OS keychain, system tray, and scheduled scans |

Both modes share the same Next.js app and API routes. The Electron-specific features (credential storage, scheduling, scan history) are only active when `window.electronAPI` is present, so the web version degrades gracefully.

---

## Prerequisites

```bash
npm install
```

All Electron dependencies are installed alongside the existing web dependencies — no separate install step.

### macOS — Xcode Command Line Tools
`better-sqlite3` is a native Node addon and compiles during `npm install`. If the install fails with a node-gyp error:

```bash
xcode-select --install
```

### Windows
Install the Visual Studio C++ Build Tools (the "Desktop development with C++" workload in Visual Studio Installer), then re-run `npm install`.

---

## Running in development

```bash
npm run electron:dev
```

This runs two processes in parallel via `concurrently`:
1. `next dev -p 3005` — the Next.js dev server with hot reload
2. `electron .` — the Electron shell, opened once Next.js is ready (via `wait-on`)

The browser DevTools are available via **View → Toggle Developer Tools** inside the app window.

---

## First-time setup (Settings)

Open **Settings** (gear icon in the header, or the system tray → Settings) and configure:

### 1. Anthropic API Key
Required for all AI analysis. Enter your key under **Anthropic API Key** and click **Save**.
The key is encrypted with the OS keychain and never stored in plaintext.

### 2. Directory credentials (for scheduled scans)
Save credentials for each provider you want the scheduler to use automatically.

**Google Workspace**
- Create a service account in Google Cloud Console with **domain-wide delegation**
- Grant it the Admin SDK scopes: `admin.directory.user.readonly`, `admin.reports.audit.readonly`
- Download the JSON key file and paste its contents into the **Service Account JSON** field
- Enter a Super Admin email address for impersonation

**Microsoft Entra ID**
- Register an app in the Azure portal (Azure Active Directory → App registrations)
- Add API permissions: `AuditLog.Read.All`, `Directory.Read.All`, `Application.Read.All` (all Application type, not Delegated)
- Create a client secret under **Certificates & secrets**
- Enter the Tenant ID, Client ID, and Client Secret

**Okta**
- In Okta Admin: Security → API → Tokens → Create Token
- A **Read-Only Administrator** role is sufficient
- Enter your Okta domain (e.g. `yourcompany.okta.com`) and the token

### 3. Scheduled scans
Enable auto-scanning and pick a frequency. The scheduler runs in the background even when the window is closed, as long as the app is running in the system tray. A desktop notification fires when each scan completes.

---

## Architecture

```
electron/
  main.ts         Main process: BrowserWindow, system tray, IPC, Next.js server spawn
  preload.ts      Context bridge: exposes window.electronAPI to the renderer
  credentials.ts  OS-native encryption via safeStorage (macOS Keychain / Windows DPAPI / Linux libsecret)
  db.ts           SQLite via better-sqlite3: scan history + schedule config
  scheduler.ts    node-cron: fires IdP fetch → basic scan → save → notify on schedule

types/
  electron-api.d.ts   TypeScript type for window.electronAPI (used in React components)

assets/
  tray-icon.png   16×16 monochrome PNG for the system tray (template image on macOS)
  icon.icns       macOS app icon
  icon.ico        Windows app icon
  icon.png        Linux app icon (512×512 recommended)
  entitlements.mac.plist  macOS hardened runtime entitlements (required for notarization)
```

### How dev vs production differ

| Concern | Development | Production |
|---|---|---|
| Next.js | `next dev` runs separately | Electron spawns `.next/standalone/server.js` |
| Electron entry | `electron .` (reads `main` from package.json) | Packaged `.app` / `.exe` / `.AppImage` |
| API key injection | Set `ANTHROPIC_API_KEY` in your shell | Decrypted from safeStorage, injected into the Next.js server process env |

### Data stored on disk

All data lives in the OS user-data directory — nothing is sent to SolutionScape servers.

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/SolutionScape AI Governance/` |
| Windows | `%APPDATA%\SolutionScape AI Governance\` |
| Linux | `~/.config/SolutionScape AI Governance/` |

Contents:
- `credentials/` — OS-encrypted `.enc` blobs (Anthropic key + per-provider IdP credentials)
- `governance.db` — SQLite database with scan history and schedule config

---

## Building a distributable

### 1. Compile the Electron main process
```bash
npm run electron:compile
```
Runs `tsc --project tsconfig.electron.json`, compiling `electron/*.ts` → `electron-dist/`.

### 2. Build the Next.js app (standalone mode)
```bash
npm run build
```
Produces `.next/standalone/` — a self-contained server with bundled dependencies.
Also copy static assets (electron-builder handles this automatically via `extraResources` in `electron-builder.yml`):

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

> **Note:** The `output: "standalone"` setting in `next.config.js` enables this. Do not remove it.

### 3. Package for distribution

| Platform | Command | Output |
|---|---|---|
| macOS (universal) | `npm run electron:dist:mac` | `dist-electron/*.dmg` and `dist-electron/*.zip` |
| Windows | `npm run electron:dist:win` | `dist-electron/*.exe` (NSIS installer) |
| Linux | `npm run electron:dist:linux` | `dist-electron/*.AppImage` |
| All platforms | `npm run electron:dist` | All of the above |

Or run everything in one shot (compile + build + package):
```bash
npm run electron:dist:mac
```

### macOS notarization
To distribute outside the Mac App Store, the app must be signed and notarized.

1. Add your Apple Developer certificate to Keychain
2. Set environment variables before running electron-builder:
```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```
3. Add `entitlements.mac.plist` to the `assets/` folder:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
```

---

## Required asset files

The app builds without these but will show a blank tray icon and a default Electron icon. Add them before distributing.

| File | Size | Notes |
|---|---|---|
| `assets/tray-icon.png` | 16×16 or 32×32 | Monochrome PNG. On macOS, set as a template image (black on transparent). |
| `assets/icon.icns` | — | macOS app icon. Generate with `iconutil` from a 1024×1024 PNG. |
| `assets/icon.ico` | — | Windows app icon. Use a tool like `png2ico` or ImageMagick. |
| `assets/icon.png` | 512×512 | Linux app icon. |

To generate `icon.icns` from a PNG on macOS:
```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
cp               icon.png   icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o assets/icon.icns
```

---

## IPC channels (for reference)

The preload script exposes `window.electronAPI` to React components. Available only inside Electron — always check `window.electronAPI` before calling.

```typescript
// Anthropic API key
window.electronAPI.apiKey.save(key)
window.electronAPI.apiKey.has()
window.electronAPI.apiKey.clear()

// IdP credentials (provider = "google" | "microsoft" | "okta")
window.electronAPI.credentials.save(provider, data)
window.electronAPI.credentials.load(provider)
window.electronAPI.credentials.has(provider)
window.electronAPI.credentials.clear(provider)

// Scheduled scans
window.electronAPI.schedule.get()          // → ScheduleConfig
window.electronAPI.schedule.set({ enabled, cronExpr })
window.electronAPI.schedule.runNow()

// Scan history (SQLite)
window.electronAPI.reports.list()          // → ReportSummary[]
window.electronAPI.reports.get(id)         // → BasicAIReport | null

// Events from main process
window.electronAPI.on("scan:complete", (report) => { ... })
window.electronAPI.on("scan:error", (message) => { ... })
window.electronAPI.on("schedule:updated", (config) => { ... })
```

---

## Troubleshooting

**`better-sqlite3` fails to load**
Native addons must be compiled for the exact Electron Node.js version. If you see a `NODE_MODULE_VERSION` mismatch after updating Electron:
```bash
./node_modules/.bin/electron-rebuild
```

**`safeStorage.isEncryptionAvailable()` returns false (Linux)**
Install `libsecret` and ensure a keyring daemon is running:
```bash
sudo apt-get install libsecret-1-dev gnome-keyring
```

**Next.js server fails to start in production**
Verify the standalone build is present and static assets are copied:
```bash
ls .next/standalone/server.js
ls .next/standalone/.next/static
ls .next/standalone/public
```

**White screen on launch**
The Electron window opened before Next.js was ready. In dev, `wait-on` handles this. In production, the main process waits up to 5 seconds — increase `setTimeout(resolve, 5000)` in `electron/main.ts` if needed on slower machines.

**App does not appear in system tray**
`assets/tray-icon.png` is missing or unreadable. The app falls back to an empty icon — add the file and restart.
