import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const workspace = request.nextUrl.searchParams.get("workspace") ?? undefined;

  try {
    const client = getClient(workspace);
    const frameworks = await client.getFrameworks();
    return NextResponse.json({ frameworks });
  } catch (error) {
    console.error("Failed to fetch frameworks:", error instanceof Error ? error.message : error);
    return NextResponse.json({ frameworks: [] });
  }
}
