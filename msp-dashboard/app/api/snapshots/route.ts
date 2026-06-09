import { NextResponse } from "next/server";
import { listWorkspaceNames } from "@/lib/drata-client";
import { loadSnapshot, isStale } from "@/lib/snapshot-store";
import { buildFreshSnapshot, buildErrorSnapshot } from "@/lib/build-snapshot";
import type { WorkspaceSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const workspaceNames = listWorkspaceNames();

  if (workspaceNames.length === 0) {
    return NextResponse.json(
      { error: "No workspaces configured. Set DRATA_API_KEY or DRATA_TENANTS." },
      { status: 500 }
    );
  }

  const results = await Promise.allSettled(
    workspaceNames.map(async (name): Promise<WorkspaceSnapshot> => {
      const cached = loadSnapshot(name);

      if (cached && !isStale(cached)) {
        return cached;
      }

      // Stale or missing — fetch fresh
      try {
        const fresh = await buildFreshSnapshot(name);
        return fresh;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return buildErrorSnapshot(name, message, cached);
      }
    })
  );

  const snapshots: WorkspaceSnapshot[] = results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const message =
      result.reason instanceof Error ? result.reason.message : String(result.reason);
    return buildErrorSnapshot(workspaceNames[i], message, null);
  });

  return NextResponse.json({ snapshots });
}
