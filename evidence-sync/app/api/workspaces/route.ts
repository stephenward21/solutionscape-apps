import { NextResponse } from "next/server";
import { listWorkspaceNames } from "@/lib/drata-client";

export async function GET(): Promise<NextResponse> {
  try {
    const names = listWorkspaceNames();
    const workspaces = names.map((name) => ({ name }));
    return NextResponse.json({ workspaces });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list workspaces" },
      { status: 500 }
    );
  }
}
