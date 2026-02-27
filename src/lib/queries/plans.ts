import { prisma } from "@/lib/db";

export async function getPlans() {
  return prisma.plan.findMany({
    where: {
      document: { isNot: null },
    },
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
      _count: {
        select: { children: true, reports: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type PlanListItem = Awaited<ReturnType<typeof getPlans>>[number];

export async function getPlanById(id: string) {
  return prisma.plan.findUnique({
    where: { id },
    include: {
      planType: true,
      organization: true,
      parent: { select: { id: true, nameVi: true } },
      document: {
        include: {
          sections: {
            where: { parentId: null },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              level: true,
              sectionNumber: true,
              titleVi: true,
              contentVi: true,
              sortOrder: true,
              _count: { select: { children: true, targets: true } },
            },
          },
          appendices: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              appendixNumber: true,
              titleVi: true,
              appendixType: true,
              sortOrder: true,
              _count: { select: { rows: true } },
            },
          },
          _count: { select: { sections: true } },
        },
      },
      _count: {
        select: { children: true, reports: true },
      },
    },
  });
}

export type PlanDetail = NonNullable<Awaited<ReturnType<typeof getPlanById>>>;

export async function getSectionChildren(documentId: string, parentId: string) {
  const [children, targets] = await Promise.all([
    prisma.planSection.findMany({
      where: { documentId, parentId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        level: true,
        sectionNumber: true,
        titleVi: true,
        contentVi: true,
        sortOrder: true,
        _count: { select: { children: true, targets: true } },
      },
    }),
    prisma.planTarget.findMany({
      where: { sectionId: parentId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        targetType: true,
        nameVi: true,
        unit: true,
        targetValue: true,
        targetYear: true,
        baselineValue: true,
        baselineYear: true,
        targetMin: true,
        targetMax: true,
        rawTextVi: true,
      },
    }),
  ]);
  return { children, targets };
}

export async function getAllTargets(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { document: { select: { id: true } } },
  });
  if (!plan?.document) return [];

  return prisma.planTarget.findMany({
    where: { section: { documentId: plan.document.id } },
    include: {
      section: {
        select: { sectionNumber: true, titleVi: true },
      },
    },
    orderBy: { id: "asc" },
  });
}

export async function getAppendixRows(appendixId: string) {
  return prisma.appendixRow.findMany({
    where: { appendixId },
    orderBy: { sortOrder: "asc" },
  });
}
