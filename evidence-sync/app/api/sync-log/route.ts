import { NextResponse } from "next/server";
import { listSyncLog } from "@/lib/sync-log-store";

export async function GET(): Promise<NextResponse> {
  try {
    const entries = listSyncLog();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Failed to fetch sync log:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sync log" },
      { status: 500 }
    );
  }
}
