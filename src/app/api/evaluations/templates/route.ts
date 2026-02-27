import { NextRequest, NextResponse } from "next/server";
import { getTemplates } from "@/lib/queries/reports";
import type { ReportType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") as ReportType;

  if (!type) {
    return NextResponse.json(
      { error: "type is required (PERIODIC_5Y or AD_HOC)" },
      { status: 400 }
    );
  }

  const templates = await getTemplates(type);
  return NextResponse.json(templates);
}
