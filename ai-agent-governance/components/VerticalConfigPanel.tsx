"use client";

import { useState, useEffect } from "react";
import {
  VERTICAL_DEFINITIONS,
  FRAMEWORK_DEFINITIONS,
  frameworksForVertical,
  type IndustryVertical,
  type ComplianceFramework,
  type OrgVerticalConfig,
} from "@/lib/verticals";

const STORAGE_KEY = "ss:org-vertical-config";

export function loadOrgConfig(): OrgVerticalConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OrgVerticalConfig) : null;
  } catch {
    return null;
  }
}

export function saveOrgConfig(config: OrgVerticalConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage unavailable
  }
}

interface Props {
  onSaved?: (config: OrgVerticalConfig) => void;
}

export default function VerticalConfigPanel({ onSaved }: Props) {
  const [orgName, setOrgName]         = useState("");
  const [vertical, setVertical]       = useState<IndustryVertical>("general");
  const [frameworks, setFrameworks]   = useState<ComplianceFramework[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [saved, setSaved]             = useState(false);
  const [loaded, setLoaded]           = useState(false);

  // Load saved config on mount
  useEffect(() => {
    const existing = loadOrgConfig();
    if (existing) {
      setOrgName(existing.orgName ?? "");
      setVertical(existing.vertical);
      setFrameworks(existing.frameworks);
      setCustomNotes(existing.customNotes ?? "");
    }
    setLoaded(true);
  }, []);

  // When vertical changes, seed frameworks with defaults (only if user hasn't customised)
  function handleVerticalChange(v: IndustryVertical) {
    setVertical(v);
    setFrameworks(VERTICAL_DEFINITIONS[v].defaultFrameworks);
    setSaved(false);
  }

  function toggleFramework(fw: ComplianceFramework) {
    setFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    );
    setSaved(false);
  }

  function handleSave() {
    const config: OrgVerticalConfig = { vertical, frameworks, orgName: orgName || undefined, customNotes: customNotes || undefined };
    saveOrgConfig(config);
    setSaved(true);
    onSaved?.(config);
  }

  const availableFrameworks = frameworksForVertical(vertical) as ComplianceFramework[];

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Organization Profile</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Set your industry vertical and compliance frameworks. These are injected into every AI scan to
          produce regulation-cited, vertical-specific risk assessments instead of generic scoring.
        </p>
      </div>

      {/* Org name */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Name</label>
        <input
          type="text"
          placeholder="e.g. Acme Energy Corp"
          value={orgName}
          onChange={(e) => { setOrgName(e.target.value); setSaved(false); }}
          className="w-full sm:max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Industry vertical */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">Industry Vertical</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.entries(VERTICAL_DEFINITIONS) as [IndustryVertical, typeof VERTICAL_DEFINITIONS[IndustryVertical]][]).map(([id, def]) => (
            <button
              key={id}
              onClick={() => handleVerticalChange(id)}
              className={`text-left border rounded-xl p-3.5 transition-all ${
                vertical === id
                  ? "border-brand-500 bg-brand-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl shrink-0 mt-0.5">{def.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${vertical === id ? "text-brand-700" : "text-slate-800"}`}>
                      {def.label}
                    </p>
                    {vertical === id && (
                      <span className="shrink-0 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{def.description}</p>
                </div>
              </div>
              {/* Sensitive data preview */}
              {vertical === id && (
                <div className="mt-2.5 pt-2 border-t border-brand-200">
                  <p className="text-xs text-brand-600 font-medium mb-1">Protected data types:</p>
                  <div className="flex flex-wrap gap-1">
                    {def.sensitiveDataTypes.slice(0, 4).map((d) => (
                      <span key={d} className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                        {d}
                      </span>
                    ))}
                    {def.sensitiveDataTypes.length > 4 && (
                      <span className="text-xs text-brand-500">+{def.sensitiveDataTypes.length - 4} more</span>
                    )}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Compliance frameworks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-700">Compliance Frameworks</label>
          <span className="text-xs text-slate-400">{frameworks.length} selected</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Select all frameworks your organization must comply with. AI tool risk factors will cite
          specific requirements from these frameworks.
        </p>

        <div className="space-y-1.5">
          {availableFrameworks.map((fw) => {
            const def = FRAMEWORK_DEFINITIONS[fw];
            const isChecked = frameworks.includes(fw);
            const isDefault = VERTICAL_DEFINITIONS[vertical].defaultFrameworks.includes(fw);
            return (
              <label
                key={fw}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isChecked
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleFramework(fw)}
                  className="mt-0.5 shrink-0 accent-brand-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{def.icon}</span>
                    <span className={`text-sm font-semibold ${isChecked ? "text-brand-700" : "text-slate-800"}`}>
                      {def.label}
                    </span>
                    {isDefault && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{def.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {availableFrameworks.length === 0 && (
          <p className="text-sm text-slate-400 italic">No specific frameworks for this vertical — using general best practices.</p>
        )}
      </div>

      {/* Custom compliance notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Additional Compliance Context
          <span className="ml-1.5 font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={3}
          placeholder="e.g. We are a Tier 1 CFATS facility handling Chlorine above the screening threshold. All process safety documentation is stored in SharePoint. Engineering teams use GitHub Copilot..."
          value={customNotes}
          onChange={(e) => { setCustomNotes(e.target.value); setSaved(false); }}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
        <p className="text-xs text-slate-400 mt-1">
          Free-text context passed directly to the AI analyst. Include anything that should influence
          risk assessment — specific systems, data classifications, or active audits.
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saved}
          className="bg-brand-600 hover:bg-brand-500 disabled:bg-emerald-500 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors flex items-center gap-2"
        >
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            "Save Organization Profile"
          )}
        </button>
        {saved && (
          <p className="text-xs text-slate-500">
            Profile saved — all future scans will apply {VERTICAL_DEFINITIONS[vertical].label} risk guidance.
          </p>
        )}
      </div>

      {/* Context preview */}
      {vertical !== "general" && (
        <details className="border border-slate-200 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Preview: what gets sent to the AI analyst
          </summary>
          <pre className="p-4 text-xs text-slate-600 bg-white overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {/* Show a snippet of the risk context so admins can verify */}
            {VERTICAL_DEFINITIONS[vertical].riskContext.slice(0, 600)}
            {VERTICAL_DEFINITIONS[vertical].riskContext.length > 600 ? "\n…" : ""}
          </pre>
        </details>
      )}
    </div>
  );
}
