import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const workspace = searchParams.get("workspace") ?? undefined;
  // v2: framework filtering is by name (frameworkTags), not slug
  const frameworkName = searchParams.get("frameworkName") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  try {
    const client = getClient(workspace);
    const controls = await client.getControls({ frameworkName, search });
    return NextResponse.json({ controls });
  } catch (error) {
    console.error("Failed to fetch controls:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch controls" },
      { status: 500 }
    );
  }
}
