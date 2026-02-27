import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReportById } from "@/lib/queries/reports";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReportById(id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { title, periodStart, periodEnd, status, items } = body;

    // Update report
    const report = await prisma.evaluationReport.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(periodStart && { periodStart: new Date(periodStart) }),
        ...(periodEnd && { periodEnd: new Date(periodEnd) }),
        ...(status && { status }),
      },
    });

    // Update items if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await prisma.evaluationItem.update({
            where: { id: item.id },
            data: {
              content: item.content || null,
            },
          });
        }
      }
    }

    const updated = await getReportById(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.evaluationReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete report:", error);
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
