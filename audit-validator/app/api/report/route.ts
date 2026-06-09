import { NextResponse } from "next/server";
import { listReports, loadReport } from "@/lib/report-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const report = loadReport(id);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(report);
  }
  return NextResponse.json({ reports: listReports() });
}
