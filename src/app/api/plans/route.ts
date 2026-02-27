import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const level = searchParams.get("level");
  const organizationId = searchParams.get("organizationId");

  const where: Prisma.PlanWhereInput = {
    document: { isNot: null },
  };

  if (search) {
    where.OR = [
      { nameVi: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) {
    where.status = status as Prisma.EnumPlanStatusFilter;
  }
  if (level) {
    where.planType = { level: level as any };
  }
  if (organizationId) {
    where.organizationId = organizationId;
  }

  const plans = await prisma.plan.findMany({
    where,
    include: {
      planType: true,
      organization: true,
      parent: { select: { id: true, nameVi: true } },
      document: {
        select: {
          id: true,
          documentNumber: true,
          parseStatus: true,
          _count: { select: { sections: true } },
        },
      },
      _count: { select: { children: true, reports: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans);
}
