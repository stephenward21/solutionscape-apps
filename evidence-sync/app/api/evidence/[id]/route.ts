import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/drata-client";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const workspace = request.nextUrl.searchParams.get("workspace") ?? undefined;
  const evidenceId = Number(params.id);

  if (isNaN(evidenceId)) {
    return NextResponse.json({ error: "Invalid evidence ID" }, { status: 400 });
  }

  try {
    const client = getClient(workspace);
    await client.deleteEvidence(evidenceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete evidence:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
