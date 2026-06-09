"use client";

interface WorkspacePickerProps {
  workspaces: string[];
  selected: string;
  onChange: (workspace: string) => void;
  disabled?: boolean;
}

export default function WorkspacePicker({
  workspaces,
  selected,
  onChange,
  disabled,
}: WorkspacePickerProps) {
  const isSingleTenant = workspaces.length <= 1;

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-slate-600">Workspace:</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={isSingleTenant || disabled}
        className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {workspaces.map((ws) => (
          <option key={ws} value={ws}>
            {ws}
          </option>
        ))}
        {workspaces.length === 0 && <option value="">No workspaces configured</option>}
      </select>
    </div>
  );
}
