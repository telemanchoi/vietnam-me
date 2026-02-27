import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function summary() {
  const docs = await prisma.planDocument.findMany({
    select: {
      documentNumber: true,
      documentType: true,
      parseStatus: true,
      plan: { select: { planType: { select: { level: true } } } },
      _count: { select: { sections: true, appendices: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalSections = await prisma.planSection.count();
  const totalTargets = await prisma.planTarget.count();
  const totalAppendices = await prisma.planAppendix.count();
  const totalRows = await prisma.appendixRow.count();

  console.log('=== DB SUMMARY ===');
  console.log('Documents:', docs.length);
  console.log('Sections:', totalSections);
  console.log('Targets:', totalTargets);
  console.log('Appendices:', totalAppendices);
  console.log('AppendixRows:', totalRows);

  console.log('\n--- By Level ---');
  const byLevel: Record<string, { count: number; withContent: number }> = {};
  for (const d of docs) {
    const lvl = d.plan?.planType?.level || 'UNKNOWN';
    if (!(lvl in byLevel)) byLevel[lvl] = { count: 0, withContent: 0 };
    byLevel[lvl].count++;
    if (d._count.sections > 0) byLevel[lvl].withContent++;
  }
  for (const [lvl, info] of Object.entries(byLevel)) {
    console.log(`  ${lvl}: ${info.count} docs (${info.withContent} with parsed content)`);
  }

  console.log('\n--- Documents with content ---');
  for (const d of docs) {
    if (d._count.sections > 0) {
      console.log(`  ${d.documentNumber} [${d.plan?.planType?.level}]: ${d._count.sections} sections`);
    }
  }

  console.log('\n--- Documents without content (image-scanned PDFs) ---');
  const noContent = docs.filter((d) => d._count.sections === 0);
  console.log(`  ${noContent.length} documents with 0 sections`);

  await prisma.$disconnect();
}

summary().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
