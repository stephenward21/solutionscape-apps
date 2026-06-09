"use client";

import { useState } from "react";
import type {
  DrataWorkspace,
  DrataControl,
  UploadedFile,
  FileMapping,
  ValidationReport,
} from "@/lib/types";
import SetupStep from "./SetupStep";
import UploadStep from "./UploadStep";
import MappingStep from "./MappingStep";
import ReportView from "./ValidationReport";

type Step = "setup" | "upload" | "mapping" | "report";

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: "setup", label: "Setup", icon: "1" },
  { id: "upload", label: "Upload Evidence", icon: "2" },
  { id: "mapping", label: "Map to Controls", icon: "3" },
  { id: "report", label: "AI Report", icon: "4" },
];

export default function ValidatorApp() {
  const [step, setStep] = useState<Step>("setup");
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState<DrataWorkspace | null>(null);
  const [controls, setControls] = useState<DrataControl[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [mappings, setMappings] = useState<FileMapping[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function stepIndex(s: Step) {
    return STEPS.findIndex((x) => x.id === s);
  }

  async function runValidation() {
    if (!workspace) return;
    setValidating(true);
    setValidationError(null);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          files,
          mappings,
          controls,
        }),
      });
      const data = (await res.json()) as ValidationReport & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      setReport(data);
      setStep("report");
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : String(err));
    } finally {
      setValidating(false);
    }
  }

  const currentIdx = stepIndex(step);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-800">Audit Readiness Validator</div>
            <div className="text-xs text-slate-400">AI-powered evidence validation against Drata controls</div>
          </div>
        </div>
      </header>

      {/* Step progress */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const done = currentIdx > i;
            const active = currentIdx === i;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done
                        ? "bg-brand-600 text-white"
                        : active
                        ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {done ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.icon
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      active ? "text-brand-700" : done ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded ${done ? "bg-brand-400" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === "setup" && (
          <SetupStep
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            workspace={workspace}
            onWorkspaceChange={(ws, ctrls) => {
              setWorkspace(ws);
              setControls(ctrls);
            }}
            onNext={() => setStep("upload")}
          />
        )}
        {step === "upload" && (
          <UploadStep
            files={files}
            onFilesChange={setFiles}
            onBack={() => setStep("setup")}
            onNext={() => setStep("mapping")}
          />
        )}
        {step === "mapping" && (
          <MappingStep
            files={files}
            controls={controls}
            mappings={mappings}
            onMappingsChange={setMappings}
            onBack={() => setStep("upload")}
            onValidate={runValidation}
            validating={validating}
            error={validationError}
          />
        )}
        {step === "report" && report && (
          <ReportView
            report={report}
            onReset={() => {
              setStep("setup");
              setFiles([]);
              setMappings([]);
              setReport(null);
              setWorkspace(null);
              setApiKey("");
              setControls([]);
            }}
          />
        )}
      </div>
    </div>
  );
}
