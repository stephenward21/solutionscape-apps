"use client";

import { useState, useEffect } from "react";
import type { UploadedFile, DrataControl, FileMapping } from "@/lib/types";

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📎";
}

export default function MappingStep({
  files,
  controls,
  mappings,
  onMappingsChange,
  onBack,
  onValidate,
  validating,
  error,
}: {
  files: UploadedFile[];
  controls: DrataControl[];
  mappings: FileMapping[];
  onMappingsChange: (m: FileMapping[]) => void;
  onBack: () => void;
  onValidate: () => void;
  validating: boolean;
  error: string | null;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(files[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("ALL");

  // Ensure every file has a mapping entry
  useEffect(() => {
    const existing = new Set(mappings.map((m) => m.fileId));
    const missing = files.filter((f) => !existing.has(f.id));
    if (missing.length > 0) {
      onMappingsChange([
        ...mappings,
        ...missing.map((f) => ({ fileId: f.id, controlIds: [] })),
      ]);
    }
  }, [files, mappings, onMappingsChange]);

  function getMappingFor(fileId: string): FileMapping {
    return mappings.find((m) => m.fileId === fileId) ?? { fileId, controlIds: [] };
  }

  function toggleControl(fileId: string, controlId: number) {
    onMappingsChange(
      mappings.map((m) => {
        if (m.fileId !== fileId) return m;
        const has = m.controlIds.includes(controlId);
        return {
          ...m,
          controlIds: has
            ? m.controlIds.filter((id) => id !== controlId)
            : [...m.controlIds, controlId],
        };
      })
    );
  }

  const totalMapped = mappings.reduce((sum, m) => sum + m.controlIds.length, 0);
  const allMapped = mappings.every((m) => m.controlIds.length > 0);

  // Get unique framework tags
  const allTags = Array.from(
    new Set(controls.flatMap((c) => c.frameworkTags ?? []))
  ).sort();

  const filteredControls = controls
    .filter(
      (c) =>
        (frameworkFilter === "ALL" || c.frameworkTags?.includes(frameworkFilter)) &&
        (!search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.code ?? "").toLowerCase().includes(search.toLowerCase()))
    )
    .slice(0, 100); // Limit to 100 in list for performance

  const activeMapping = selectedFile ? getMappingFor(selectedFile) : null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* File list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Evidence Files
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({files.length} total)
            </span>
          </h3>
          <div className="space-y-2">
            {files.map((f) => {
              const mapping = getMappingFor(f.id);
              const count = mapping.controlIds.length;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedFile(f.id)}
                  className={`w-full flex items-start gap-2 p-3 rounded-xl text-left transition-colors ${
                    selectedFile === f.id
                      ? "bg-brand-50 border border-brand-200"
                      : "bg-slate-50 border border-transparent hover:border-slate-200"
                  }`}
                >
                  <span className="text-lg mt-0.5">{fileIcon(f.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{f.name}</p>
                    <p className={`text-xs mt-0.5 ${count > 0 ? "text-emerald-600" : "text-amber-500"}`}>
                      {count > 0 ? `${count} control${count !== 1 ? "s" : ""} mapped` : "Not mapped yet"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Control picker */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          {!selectedFile ? (
            <p className="text-sm text-slate-400 text-center py-8">Select a file to map controls</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Map controls to:{" "}
                  <span className="text-brand-600">
                    {files.find((f) => f.id === selectedFile)?.name}
                  </span>
                </h3>
                {activeMapping && activeMapping.controlIds.length > 0 && (
                  <span className="text-xs text-emerald-600 font-medium">
                    {activeMapping.controlIds.length} selected
                  </span>
                )}
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search controls…"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <select
                  value={frameworkFilter}
                  onChange={(e) => setFrameworkFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white"
                >
                  <option value="ALL">All frameworks</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {filteredControls.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No controls match</p>
                ) : (
                  filteredControls.map((c) => {
                    const selected = activeMapping?.controlIds.includes(c.id) ?? false;
                    return (
                      <label
                        key={c.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          selected ? "bg-brand-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleControl(selectedFile, c.id)}
                          className="mt-0.5 accent-brand-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.code && (
                              <span className="text-xs font-mono text-slate-400">{c.code}</span>
                            )}
                            {c.frameworkTags?.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{c.name}</p>
                        </div>
                      </label>
                    );
                  })
                )}
                {controls.length > 100 && !search && (
                  <p className="text-xs text-slate-400 text-center pt-2">
                    Showing 100 of {controls.length} — use search to find specific controls
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary + actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">
            {totalMapped} control mapping{totalMapped !== 1 ? "s" : ""} across {files.length} file{files.length !== 1 ? "s" : ""}
          </p>
          {!allMapped && (
            <p className="text-xs text-amber-600 mt-0.5">
              ⚠ Some files have no controls mapped — they will be skipped
            </p>
          )}
        </div>

        {error && (
          <div className="w-full bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={onValidate}
            disabled={totalMapped === 0 || validating}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors flex items-center gap-2"
          >
            {validating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Validating with Claude…
              </>
            ) : (
              "Run AI Validation →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
