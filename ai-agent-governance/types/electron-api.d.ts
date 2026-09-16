import type { BasicAIReport } from "../lib/types";
import type { ReportSummary, ScheduleConfig } from "../electron/db";

interface ElectronAPI {
  apiKey: {
    save:  (key: string) => Promise<void>;
    has:   ()            => Promise<boolean>;
    clear: ()            => Promise<void>;
  };
  credentials: {
    save:  (provider: string, data: unknown) => Promise<void>;
    load:  (provider: string) => Promise<unknown | null>;
    has:   (provider: string) => Promise<boolean>;
    clear: (provider: string) => Promise<void>;
  };
  schedule: {
    get:    () => Promise<ScheduleConfig>;
    set:    (cfg: { enabled: boolean; cronExpr: string }) => Promise<void>;
    runNow: () => Promise<void>;
  };
  reports: {
    list: ()           => Promise<ReportSummary[]>;
    get:  (id: string) => Promise<BasicAIReport | null>;
  };
  on:  (channel: "scan:complete" | "scan:error" | "schedule:updated", fn: (...a: unknown[]) => void) => void;
  off: (channel: "scan:complete" | "scan:error" | "schedule:updated", fn: (...a: unknown[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
