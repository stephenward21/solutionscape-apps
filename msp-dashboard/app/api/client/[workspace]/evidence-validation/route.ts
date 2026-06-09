/**
 * GET  /api/client/[workspace]/evidence-validation  — return cached result or null
 * POST /api/client/[workspace]/evidence-validation  — run a fresh validation
 *
 * New data flow:
 * 1. GET controls?hasEvidence=true&expand[]=evidenceIds  → controls with evidenceIds object
 * 2. Extract all unique evidence version IDs from those controls
 * 3. Fetch each version individually (batched) → { downloadUrl, mimeType, name, ... }
 * 4. Pass to validateEvidenceLibrary() which downloads files + runs Claude
 */
import { NextResponse } from "next/server";
import { getClientForKey } from "@/lib/drata-client";
import { getWorkspaceEntry } from "@/lib/workspace-cache";
import {
  validateEvidenceLibrary,
  getCachedEvidenceValidation,
  extractEvidenceIds,
} from "@/lib/evidence-validator";
import type { DrataEvidenceLibraryVersion } from "@/lib/types";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 10; // concurrent Drata API calls for version lookups

async function batchFetch<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  batchSize: number
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }
  const cached = getCachedEvidenceValidation(workspaceId);
  return NextResponse.json({ cached: cached ?? null });
}

export async function POST(
  _req: Request,
  { params }: { params: { workspace: string } }
): Promise<NextResponse> {
  const workspaceId = parseInt(params.workspace, 10);
  if (isNaN(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const entry = await getWorkspaceEntry(workspaceId);
    if (!entry) {
      return NextResponse.json({ error: `Workspace ${workspaceId} not found` }, { status: 404 });
    }

    const client = getClientForKey(entry.apiKey);

    // Step 1: get controls that have evidence, with the evidenceIds object expanded
    const controls = await client.getControlsWithEvidence(workspaceId);

    // Step 2: collect all unique evidence version IDs across all controls
    const allVersionIds = new Set<number>();
    for (const ctrl of controls) {
      for (const id of extractEvidenceIds(ctrl)) {
        allVersionIds.add(id);
      }
    }

    const versionIdList = Array.from(allVersionIds);

    // Step 3: fetch each version in batches (gets downloadUrl, mimeType, name, etc.)
    const versionResults = await batchFetch(
      versionIdList,
      (id) => client.getEvidenceVersion(workspaceId, id as number),
      BATCH_SIZE
    ) as (DrataEvidenceLibraryVersion | null)[];

    const evidenceVersionMap = new Map<number, DrataEvidenceLibraryVersion>();
    for (let i = 0; i < versionIdList.length; i++) {
      const v = versionResults[i];
      const id = versionIdList[i];
      if (v && id !== undefined) {
        evidenceVersionMap.set(id, v);
      }
    }

    // Step 4: download files and validate with Claude
    const result = await validateEvidenceLibrary(
      workspaceId,
      entry.apiKey,
      controls,
      evidenceVersionMap
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
