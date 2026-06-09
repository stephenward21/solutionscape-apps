"use client";

interface MetadataFormProps {
  description: string;
  collectedAt: string;
  onDescriptionChange: (value: string) => void;
  onCollectedAtChange: (value: string) => void;
  disabled?: boolean;
}

export default function MetadataForm({
  description,
  collectedAt,
  onDescriptionChange,
  onCollectedAtChange,
  disabled,
}: MetadataFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          placeholder="Describe this evidence (e.g. 'MFA screenshot from production AWS console')"
          rows={3}
          className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-50 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Date Collected
        </label>
        <input
          type="date"
          value={collectedAt}
          onChange={(e) => onCollectedAtChange(e.target.value)}
          disabled={disabled}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-50"
        />
      </div>
    </div>
  );
}
