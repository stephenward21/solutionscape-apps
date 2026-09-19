import { contextBridge, ipcRenderer } from "electron";

// Expose a narrow, typed IPC bridge. No Node.js APIs leak into the renderer.
contextBridge.exposeInMainWorld("electronAPI", {
  apiKey: {
    save:  (key: string)          => ipcRenderer.invoke("apikey:save", key),
    has:   ()                     => ipcRenderer.invoke("apikey:has"),
    clear: ()                     => ipcRenderer.invoke("apikey:clear"),
  },
  credentials: {
    save:  (provider: string, data: unknown) => ipcRenderer.invoke("creds:save", provider, data),
    load:  (provider: string)                => ipcRenderer.invoke("creds:load", provider),
    has:   (provider: string)                => ipcRenderer.invoke("creds:has", provider),
    clear: (provider: string)                => ipcRenderer.invoke("creds:clear", provider),
  },
  schedule: {
    get:    ()                                              => ipcRenderer.invoke("schedule:get"),
    set:    (cfg: { enabled: boolean; cronExpr: string })  => ipcRenderer.invoke("schedule:set", cfg),
    runNow: ()                                             => ipcRenderer.invoke("schedule:run-now"),
  },
  reports: {
    list:  ()                      => ipcRenderer.invoke("reports:list"),
    get:   (id: string)            => ipcRenderer.invoke("reports:get", id),
    save:  (report: unknown)       => ipcRenderer.invoke("reports:save", report),
    print: (html: string)          => ipcRenderer.invoke("report:print", html),
  },
  on:  (channel: string, fn: (...a: unknown[]) => void) => {
    const allowed = ["scan:complete", "scan:error", "schedule:updated"];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, ...a) => fn(...a));
  },
  off: (channel: string, fn: (...a: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, fn);
  },
});
