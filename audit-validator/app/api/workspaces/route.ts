import { NextResponse } from "next/server";
import { makeClient } from "@/lib/drata-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get("apiKey");
  if (!apiKey) return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  try {
    const client = makeClient(apiKey);
    const workspaces = await client.listWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
