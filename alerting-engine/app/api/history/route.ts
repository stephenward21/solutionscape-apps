import { NextResponse } from "next/server";
import { loadEvents } from "@/lib/history-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "50", 10);
  return NextResponse.json({ events: loadEvents(Math.min(limit, 200)) });
}
