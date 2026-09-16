import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  Notification,
  nativeImage,
  shell,
} from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import {
  initDb,
  saveReport,
  listReports,
  getReport,
  getScheduleConfig,
  setScheduleConfig,
  recordRun,
} from "./db";
import {
  encryptCredential,
  decryptCredential,
  hasCredential,
  deleteCredential,
} from "./credentials";
import { Scheduler } from "./scheduler";
import type { BasicAIReport } from "../lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const PORT  = 3005;
const APP_URL = `http://localhost:${PORT}`;

// ─── State ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nextServer: ChildProcess | null = null;
let isQuitting = false;
let scheduler: Scheduler;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    title: "SolutionScape AI Governance",
    backgroundColor: "#f8fafc",
  });

  void mainWindow.loadURL(APP_URL);

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Open external links in the default browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Hide to tray instead of closing (macOS convention)
  mainWindow.on("close", (e) => {
    if (!isQuitting && process.platform === "darwin") {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

// ─── System tray ──────────────────────────────────────────────────────────────

function buildTrayMenu(): Menu {
  const config = getScheduleConfig();
  return Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: "separator" },
    {
      label: config.enabled
        ? `Auto-scan enabled  (${config.cronExpr})`
        : "Auto-scan disabled",
      enabled: false,
    },
    {
      label: "Run Scan Now",
      click: () => void scheduler.runNow(),
    },
    { type: "separator" },
    { label: "Settings", click: () => { mainWindow?.show(); void mainWindow?.loadURL(`${APP_URL}/settings`); } },
    { type: "separator" },
    { label: "Quit SolutionScape", click: () => { isQuitting = true; app.quit(); } },
  ]);
}

function createTray(): void {
  let icon: Electron.NativeImage;
  try {
    const iconPath = isDev
      ? path.join(__dirname, "../../assets/tray-icon.png")
      : path.join(process.resourcesPath, "assets/tray-icon.png");
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    if (process.platform === "darwin") icon.setTemplateImage(true);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("SolutionScape AI Governance");
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

function refreshTrayMenu(): void {
  tray?.setContextMenu(buildTrayMenu());
}

// ─── Next.js server (production only) ────────────────────────────────────────

async function startNextServer(): Promise<void> {
  if (isDev) return; // next dev runs separately in development

  return new Promise((resolve) => {
    const serverJs = path.join(
      process.resourcesPath,
      ".next/standalone/server.js"
    );

    nextServer = spawn(process.execPath, [serverJs], {
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        // Inject saved API key into the Next.js server process
        ANTHROPIC_API_KEY: decryptCredential("anthropic_key") ?? "",
      },
    });

    const tryResolve = (data: Buffer) => {
      const text = data.toString();
      if (text.includes("localhost") || text.includes("started server")) {
        resolve();
      }
    };

    nextServer.stdout?.on("data", tryResolve);
    nextServer.stderr?.on("data", (d: Buffer) => console.error("[Next]", d.toString()));

    // Fallback — give Next.js 5 seconds to start
    setTimeout(resolve, 5000);
  });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Anthropic API key
  ipcMain.handle("apikey:save",  (_, key: string) => encryptCredential("anthropic_key", key));
  ipcMain.handle("apikey:has",   ()               => hasCredential("anthropic_key"));
  ipcMain.handle("apikey:clear", ()               => deleteCredential("anthropic_key"));

  // IdP credentials (per-provider)
  ipcMain.handle("creds:save",  (_, provider: string, data: unknown) =>
    encryptCredential(`idp_${provider}`, JSON.stringify(data)));
  ipcMain.handle("creds:load",  (_, provider: string) => {
    const raw = decryptCredential(`idp_${provider}`);
    return raw ? JSON.parse(raw) as unknown : null;
  });
  ipcMain.handle("creds:has",   (_, provider: string) => hasCredential(`idp_${provider}`));
  ipcMain.handle("creds:clear", (_, provider: string) => deleteCredential(`idp_${provider}`));

  // Schedule
  ipcMain.handle("schedule:get", () => getScheduleConfig());
  ipcMain.handle("schedule:set", (_, cfg: { enabled: boolean; cronExpr: string }) => {
    setScheduleConfig(cfg);
    cfg.enabled ? scheduler.start(cfg.cronExpr) : scheduler.stop();
    refreshTrayMenu();
    mainWindow?.webContents.send("schedule:updated", getScheduleConfig());
  });
  ipcMain.handle("schedule:run-now", () => void scheduler.runNow());

  // Report history
  ipcMain.handle("reports:list", () => listReports());
  ipcMain.handle("reports:get",  (_, id: string) => getReport(id));
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Enforce single instance
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.on("second-instance", () => { mainWindow?.show(); mainWindow?.focus(); });

  initDb();

  scheduler = new Scheduler({
    port: () => PORT,
    getApiKey: () => decryptCredential("anthropic_key"),
    getCredentials: (provider) => {
      const raw = decryptCredential(`idp_${provider}`);
      return raw ? JSON.parse(raw) as unknown : null;
    },
    onComplete: (report: BasicAIReport) => {
      saveReport(report);
      recordRun(new Date().toISOString(), null);
      refreshTrayMenu();

      new Notification({
        title: "AI Governance Scan Complete",
        body: `Found ${report.totalAIToolsFound} AI tools · ${report.criticalTools} critical`,
      }).show();

      mainWindow?.webContents.send("scan:complete", report);
    },
    onError: (msg: string) => {
      new Notification({ title: "AI Governance Scan Failed", body: msg }).show();
      mainWindow?.webContents.send("scan:error", msg);
    },
  });

  registerIpcHandlers();
  await startNextServer();
  createWindow();
  createTray();

  // Restore scheduled job if it was previously enabled
  const cfg = getScheduleConfig();
  if (cfg.enabled) scheduler.start(cfg.cronExpr);
});

app.on("before-quit", () => {
  isQuitting = true;
  scheduler?.stop();
  nextServer?.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
});
