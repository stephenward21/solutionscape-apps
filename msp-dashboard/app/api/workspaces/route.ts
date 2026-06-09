import { NextResponse } from "next/server";
import { listWorkspaceEntries } from "@/lib/workspace-cache";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const entries = await listWorkspaceEntries();
    const workspaces = entries.map(({ id, name, primary, apiKeyLabel }) => ({
      id,
      name,
      primary,
      apiKeyLabel,
    }));
    return NextResponse.json({ workspaces });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
