import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReports } from "@/lib/queries/reports";
import type { ReportStatus, ReportType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const planId = searchParams.get("planId") ?? undefined;
  const status = (searchParams.get("status") as ReportStatus) ?? undefined;
  const reportType = (searchParams.get("reportType") as ReportType) ?? undefined;

  const reports = await getReports({ planId, status, reportType });
  return NextResponse.json(reports);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      planId,
      reportType,
      title,
      periodStart,
      periodEnd,
      organizationId,
      items,
    } = body;

    // Validate required fields
    if (!planId || !reportType || !title || !periodStart || !periodEnd || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const report = await prisma.evaluationReport.create({
      data: {
        planId,
        reportType,
        title,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        organizationId,
        status: "DRAFT",
        items: items?.length
          ? {
              create: items.map(
                (
                  item: { templateId: string; content: string; sortOrder: number },
                  index: number
                ) => ({
                  templateId: item.templateId,
                  content: item.content || null,
                  sortOrder: item.sortOrder ?? index,
                })
              ),
            }
          : undefined,
      },
      include: {
        items: { include: { template: true } },
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Failed to create report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}
