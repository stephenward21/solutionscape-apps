import { NextResponse } from "next/server";
import { listWorkspaceEntries } from "@/lib/workspace-cache";
import { loadSnapshot, isStale } from "@/lib/snapshot-store";
import { buildFreshSnapshot, buildErrorSnapshot } from "@/lib/build-snapshot";
import type { WorkspaceSnapshot, DrataWorkspace } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let entries;
  try {
    entries = await listWorkspaceEntries();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to list workspaces: ${message}` },
      { status: 500 }
    );
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No workspaces configured. Set DRATA_API_KEY or DRATA_TENANTS." },
      { status: 500 }
    );
  }

  const results = await Promise.allSettled(
    entries.map(async (entry): Promise<WorkspaceSnapshot> => {
      const workspace: DrataWorkspace = { id: entry.id, name: entry.name };
      const cached = loadSnapshot(entry.id);

      if (cached && !isStale(cached)) {
        return cached;
      }

      try {
        return await buildFreshSnapshot(workspace, entry.apiKey);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return buildErrorSnapshot(workspace, message, cached);
      }
    })
  );

  const snapshots: WorkspaceSnapshot[] = results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const message =
      result.reason instanceof Error ? result.reason.message : String(result.reason);
    const entry = entries[i];
    return buildErrorSnapshot(
      { id: entry?.id ?? 0, name: entry?.name ?? "Unknown" },
      message,
      null
    );
  });

  return NextResponse.json({ snapshots });
}
