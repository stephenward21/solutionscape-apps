"use client";

import type { HistoryPoint } from "@/lib/types";

interface Props {
  points: HistoryPoint[];
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({
  points,
  width = 200,
  height = 48,
  color = "#3b82f6",
}: Props) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-400"
        style={{ width, height }}
      >
        No trend data yet
      </div>
    );
  }

  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const scores = points.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const toX = (i: number) => pad + (i / (points.length - 1)) * innerW;
  const toY = (score: number) =>
    pad + innerH - ((score - minScore) / range) * innerH;

  const polyPoints = points
    .map((p, i) => `${toX(i)},${toY(p.score)}`)
    .join(" ");

  // Fill area under the line
  const firstX = toX(0);
  const lastX = toX(points.length - 1);
  const bottom = pad + innerH;
  const fillPoints = `${firstX},${bottom} ${polyPoints} ${lastX},${bottom}`;

  const lastPoint = points[points.length - 1];
  const lastX2 = toX(points.length - 1);
  const lastY = toY(lastPoint.score);

  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={lastX2}
        cy={lastY}
        r="3"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
}
