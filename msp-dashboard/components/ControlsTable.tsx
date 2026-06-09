"use client";

import { useState, useMemo } from "react";
import type { DrataControl } from "@/lib/types";

interface Props {
  controls: DrataControl[];
}

const STATUS_ORDER: Record<string, number> = {
  FAILING: 0,
  NEEDS_ATTENTION: 1,
  PASSING: 2,
  NOT_APPLICABLE: 3,
};

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    FAILING: "bg-red-100 text-red-700",
    NEEDS_ATTENTION: "bg-amber-100 text-amber-700",
    PASSING: "bg-green-100 text-green-700",
    NOT_APPLICABLE: "bg-slate-100 text-slate-500",
  };
  const labels: Record<string, string> = {
    FAILING: "Failing",
    NEEDS_ATTENTION: "Needs Attention",
    PASSING: "Passing",
    NOT_APPLICABLE: "N/A",
  };
  const cls = classes[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

type SortCol = "code" | "name" | "status" | "framework" | "owner";
type SortDir = "asc" | "desc";

export default function ControlsTable({ controls }: Props) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return controls.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q)
    );
  }, [controls, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "code":
          cmp = (a.code ?? "").localeCompare(b.code ?? "");
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp =
            (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case "framework":
          cmp = (a.frameworkSlug ?? "").localeCompare(b.frameworkSlug ?? "");
          break;
        case "owner":
          cmp = (a.owner?.name ?? "").localeCompare(b.owner?.name ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className="ml-1 text-slate-300">
      {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div>
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search by code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {(
                [
                  ["code", "Code"],
                  ["name", "Name"],
                  ["status", "Status"],
                  ["framework", "Framework"],
                  ["owner", "Owner"],
                ] as [SortCol, string][]
              ).map(([col, label]) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                >
                  {label}
                  <SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                  {c.code ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-800 max-w-xs">
                  <span className="line-clamp-2">{c.name}</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs uppercase tracking-wide">
                  {c.frameworkSlug ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                  {c.owner?.name ?? "—"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-400 text-sm"
                >
                  No controls found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        {sorted.length} of {controls.length} controls
      </p>
    </div>
  );
}
