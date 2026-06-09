"use client";

interface Props {
  status: "green" | "amber" | "red";
  size?: "sm" | "md";
}

const config: Record<
  string,
  { dot: string; label: string; text: string; bg: string }
> = {
  green: {
    dot: "bg-green-500",
    label: "Healthy",
    text: "text-green-700",
    bg: "bg-green-50",
  },
  amber: {
    dot: "bg-amber-400",
    label: "Needs Attention",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  red: {
    dot: "bg-red-500",
    label: "At Risk",
    text: "text-red-700",
    bg: "bg-red-50",
  },
};

export default function RAGBadge({ status, size = "sm" }: Props) {
  const c = config[status];
  const dotSize = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";
  const textSize = size === "md" ? "text-sm font-medium" : "text-xs font-medium";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg} ${c.text} ${textSize}`}
    >
      <span className={`rounded-full flex-shrink-0 ${dotSize} ${c.dot}`} />
      {c.label}
    </span>
  );
}
