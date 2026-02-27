import { NextRequest, NextResponse } from "next/server";
import { getMatchingSections } from "@/lib/evaluation-plan-mapping";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const planId = searchParams.get("planId");
  const itemCode = searchParams.get("itemCode");

  if (!planId || !itemCode) {
    return NextResponse.json(
      { error: "planId and itemCode are required" },
      { status: 400 }
    );
  }

  try {
    const result = await getMatchingSections(planId, itemCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to get matching sections:", error);
    return NextResponse.json(
      { error: "Failed to get matching sections" },
      { status: 500 }
    );
  }
}
