import { NextRequest, NextResponse } from "next/server";
import { getSectionChildren, getAllTargets } from "@/lib/queries/plans";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const { searchParams } = request.nextUrl;
  const parentId = searchParams.get("parentId");
  const documentId = searchParams.get("documentId");
  const all = searchParams.get("all");

  // Load all targets for the plan
  if (all === "true") {
    const targets = await getAllTargets(planId);
    return NextResponse.json({ targets });
  }

  // Load children of a specific section
  if (!parentId || !documentId) {
    return NextResponse.json(
      { error: "parentId and documentId are required" },
      { status: 400 }
    );
  }

  const data = await getSectionChildren(documentId, parentId);
  return NextResponse.json(data);
}
