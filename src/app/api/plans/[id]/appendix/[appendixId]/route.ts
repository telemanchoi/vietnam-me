import { NextRequest, NextResponse } from "next/server";
import { getAppendixRows } from "@/lib/queries/plans";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; appendixId: string }> }
) {
  const { appendixId } = await params;
  const rows = await getAppendixRows(appendixId);
  return NextResponse.json({ rows, total: rows.length });
}
