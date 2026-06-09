"use client";

import { useState, useEffect, useCallback } from "react";
import type { DrataFramework, DrataControl, ControlStatus } from "@/lib/types";
import { getControlStatus } from "@/lib/types";

interface ControlBrowserProps {
  workspace: string;
  frameworks: DrataFramework[];
  selectedControl: DrataControl | null;
  onSelectControl: (control: DrataControl) => void;
  onControlsLoaded?: (controls: DrataControl[]) => void;
}

const STATUS_COLORS: Record<ControlStatus, string> = {
  PASSING: "bg-green-500",
  FAILING: "bg-red-500",
  NEEDS_ATTENTION: "bg-yellow-500",
  NOT_APPLICABLE: "bg-slate-400",
};

export default function ControlBrowser({
  workspace,
  frameworks,
  selectedControl,
  onSelectControl,
  onControlsLoaded,
}: ControlBrowserProps) {
  const [activeFramework, setActiveFramework] = useState<DrataFramework | null>(null);
  const [controls, setControls] = useState<DrataControl[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Set default framework when frameworks load
  useEffect(() => {
    if (frameworks.length > 0 && !activeFramework) {
      setActiveFramework(frameworks[0] ?? null);
    }
    if (frameworks.length === 0) {
      setActiveFramework(null);
    }
  }, [frameworks, activeFramework]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadControls = useCallback(async () => {
    if (!workspace || !activeFramework) {
      setControls([]);
      return;
    }

    setLoading(true);
    try {
      // v2: pass frameworkName (not frameworkSlug) — filtering is client-side in the API route
      const params = new URLSearchParams({
        workspace,
        frameworkName: activeFramework.name,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/controls?${params.toString()}`);
      const data = (await res.json()) as { controls?: DrataControl[] };
      const loaded = data.controls ?? [];
      setControls(loaded);
      onControlsLoaded?.(loaded);
    } catch {
      setControls([]);
      onControlsLoaded?.([]);
    } finally {
      setLoading(false);
    }
  }, [workspace, activeFramework, debouncedSearch, onControlsLoaded]);

  useEffect(() => {
    void loadControls();
  }, [loadControls]);

  return (
    <div className="flex flex-col h-full">
      {/* Framework tabs */}
      {frameworks.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              onClick={() => {
                setActiveFramework(fw);
                setSearch("");
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeFramework?.id === fw.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {fw.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search controls..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Controls list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {loading && (
          <div className="text-center py-4 text-sm text-slate-500">Loading controls...</div>
        )}
        {!loading && controls.length === 0 && (
          <div className="text-center py-4 text-sm text-slate-500">
            {frameworks.length === 0
              ? "Select a workspace to load controls"
              : "No controls found"}
          </div>
        )}
        {!loading &&
          controls.map((control) => {
            const statusColor = STATUS_COLORS[getControlStatus(control)];
            return (
              <button
                key={control.id}
                onClick={() => onSelectControl(control)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors group ${
                  selectedControl?.id === control.id
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`}
                  />
                  <div className="min-w-0">
                    {control.code && (
                      <span
                        className={`inline-block text-xs font-mono font-semibold px-1.5 py-0.5 rounded mr-1.5 ${
                          selectedControl?.id === control.id
                            ? "bg-blue-200 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {control.code}
                      </span>
                    )}
                    <span className="text-sm leading-tight">{control.name}</span>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
