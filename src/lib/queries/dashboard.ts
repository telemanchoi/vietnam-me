import { prisma } from "@/lib/db";

export async function getDashboardStats() {
  const [
    totalPlans,
    plansByStatus,
    totalReports,
    reportsByStatus,
    recentReports,
    targetStats,
  ] = await Promise.all([
    prisma.plan.count({ where: { document: { isNot: null } } }),

    prisma.plan.groupBy({
      by: ["status"],
      _count: true,
      where: { document: { isNot: null } },
    }),

    prisma.evaluationReport.count(),

    prisma.evaluationReport.groupBy({
      by: ["status"],
      _count: true,
    }),

    prisma.evaluationReport.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        plan: { select: { id: true, nameVi: true } },
        organization: { select: { nameVi: true } },
        _count: { select: { items: true } },
      },
    }),

    prisma.planTarget.groupBy({
      by: ["targetType"],
      _count: true,
    }),
  ]);

  return {
    totalPlans,
    plansByStatus: plansByStatus.map((g) => ({
      status: g.status,
      count: g._count,
    })),
    totalReports,
    reportsByStatus: reportsByStatus.map((g) => ({
      status: g.status,
      count: g._count,
    })),
    recentReports,
    targetStats: targetStats.map((g) => ({
      type: g.targetType,
      count: g._count,
    })),
    totalTargets: targetStats.reduce((sum, g) => sum + g._count, 0),
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
