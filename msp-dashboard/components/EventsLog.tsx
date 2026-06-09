"use client";

import type { DrataEvent } from "@/lib/types";

interface Props {
  events: DrataEvent[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function EventsLog({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No recent events
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <div key={event.id} className="flex gap-4">
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            {idx < events.length - 1 && (
              <div className="w-0.5 flex-1 bg-slate-200 my-1" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-slate-800">
                {event.action}
              </span>
              {event.actor?.name && (
                <span className="text-xs text-slate-500">
                  by {event.actor.name}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                {event.description}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {relativeTime(event.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
