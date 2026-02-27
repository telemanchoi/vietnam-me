import { prisma } from "@/lib/db";
import type { ReportType, ReportStatus } from "@prisma/client";

export async function getReports(filters?: {
  planId?: string;
  status?: ReportStatus;
  reportType?: ReportType;
}) {
  return prisma.evaluationReport.findMany({
    where: {
      ...(filters?.planId && { planId: filters.planId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.reportType && { reportType: filters.reportType }),
    },
    include: {
      plan: {
        select: { id: true, nameVi: true, periodStart: true, periodEnd: true },
      },
      organization: {
        select: { id: true, nameVi: true },
      },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type ReportListItem = Awaited<ReturnType<typeof getReports>>[number];

export async function getReportById(id: string) {
  return prisma.evaluationReport.findUnique({
    where: { id },
    include: {
      plan: {
        select: {
          id: true,
          nameVi: true,
          periodStart: true,
          periodEnd: true,
          organizationId: true,
          document: { select: { id: true } },
        },
      },
      organization: {
        select: { id: true, nameVi: true },
      },
      items: {
        include: {
          template: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export type ReportDetail = NonNullable<Awaited<ReturnType<typeof getReportById>>>;

export async function getTemplates(evaluationType: ReportType) {
  return prisma.evaluationTemplate.findMany({
    where: { evaluationType },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getPlansForSelect() {
  return prisma.plan.findMany({
    where: { document: { isNot: null } },
    select: {
      id: true,
      nameVi: true,
      periodStart: true,
      periodEnd: true,
      organizationId: true,
      organization: { select: { id: true, nameVi: true } },
    },
    orderBy: { nameVi: "asc" },
  });
}
