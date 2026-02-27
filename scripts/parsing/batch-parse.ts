#!/usr/bin/env tsx
/**
 * Batch parser for Vietnamese government plan documents.
 * Processes all files in a directory with a JSON manifest.
 *
 * Usage:
 *   npx tsx scripts/parsing/batch-parse.ts --manifest scripts/parsing/manifests/sector.json [--dry-run]
 *
 * Manifest format:
 *   {
 *     "defaultType": "QUYET_DINH",
 *     "defaultLevel": "SECTOR",
 *     "defaultBody": "Thủ tướng Chính phủ",
 *     "files": [
 *       {
 *         "file": "path/to/file.pdf",
 *         "number": "1454/QĐ-TTg",
 *         "date": "2021-09-01",
 *         "type": "QUYET_DINH",       // optional override
 *         "level": "SECTOR",           // optional override
 *         "body": "Thủ tướng",         // optional override
 *         "skip": false                // optional
 *       }
 *     ]
 *   }
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { runPipeline } from './pipeline';
import type { PipelineOptions, PipelineResult } from './pipeline';

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestEntry {
  file: string;
  number: string;
  date: string;
  type?: 'NGHI_QUYET' | 'QUYET_DINH';
  level?: 'NATIONAL' | 'REGIONAL' | 'SECTOR' | 'PROVINCE';
  body?: string;
  signedBy?: string;
  skip?: boolean;
}

interface Manifest {
  baseDir?: string;  // base directory for relative file paths
  defaultType: 'NGHI_QUYET' | 'QUYET_DINH';
  defaultLevel: 'NATIONAL' | 'REGIONAL' | 'SECTOR' | 'PROVINCE';
  defaultBody: string;
  files: ManifestEntry[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let manifestPath = '';
  let dryRun = false;
  let useLLM = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--manifest':
        manifestPath = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--llm':
        useLLM = true;
        break;
      case '--force':
        force = true;
        break;
      case '--help':
      case '-h':
        console.log(`
${BOLD}Batch Vietnamese Plan Document Parser${RESET}

${CYAN}USAGE:${RESET}
  npx tsx scripts/parsing/batch-parse.ts --manifest <path> [--dry-run] [--llm] [--force]

${CYAN}OPTIONS:${RESET}
  --manifest <path>   Path to JSON manifest file (required)
  --dry-run           Don't save to DB, just print results
  --llm               Enable LLM-based KPI extraction
  --force             Re-parse documents even if already completed in DB
  --help, -h          Show this help message
`);
        process.exit(0);
    }
  }

  if (!manifestPath) {
    console.error(`${RED}Missing --manifest argument${RESET}`);
    process.exit(1);
  }

  // Load manifest
  const manifestAbs = path.resolve(manifestPath);
  if (!fs.existsSync(manifestAbs)) {
    console.error(`${RED}Manifest not found: ${manifestAbs}${RESET}`);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestAbs, 'utf-8'));
  const baseDir = manifest.baseDir
    ? path.resolve(path.dirname(manifestAbs), manifest.baseDir)
    : path.dirname(manifestAbs);

  const entries = manifest.files.filter(f => !f.skip);
  const skipped = manifest.files.filter(f => f.skip);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`${BOLD} Batch Vietnamese Plan Document Parser${RESET}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`${BLUE} Manifest:${RESET}     ${manifestAbs}`);
  console.log(`${BLUE} Base dir:${RESET}     ${baseDir}`);
  console.log(`${BLUE} Total files:${RESET}  ${manifest.files.length} (${entries.length} to process, ${skipped.length} skipped)`);
  console.log(`${BLUE} Default type:${RESET} ${manifest.defaultType}`);
  console.log(`${BLUE} Default level:${RESET}${manifest.defaultLevel}`);
  console.log(`${BLUE} Mode:${RESET}         ${dryRun ? 'DRY RUN' : 'SAVE TO DB'}`);
  console.log(`${'='.repeat(70)}\n`);

  // Load existing documents from DB for deduplication
  const prisma = new PrismaClient();
  const existingDocs = dryRun ? [] : await prisma.planDocument.findMany({
    select: { documentNumber: true, parseStatus: true, _count: { select: { sections: true } } },
  });
  await prisma.$disconnect();

  const completedDocs = new Set(
    existingDocs
      .filter(d => d.parseStatus === 'COMPLETED' && d._count.sections > 0)
      .map(d => d.documentNumber),
  );

  if (completedDocs.size > 0 && !force) {
    console.log(`${BLUE} Already parsed:${RESET} ${completedDocs.size} documents in DB (use --force to re-parse)`);
  }

  // Process each file sequentially (to avoid DB contention)
  const results: { entry: ManifestEntry; result: PipelineResult }[] = [];
  const startTime = Date.now();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const filePath = path.isAbsolute(entry.file)
      ? entry.file
      : path.join(baseDir, entry.file);

    console.log(`\n${CYAN}━━━ [${i + 1}/${entries.length}] ${path.basename(entry.file)} ━━━${RESET}`);

    // Skip already-completed documents unless --force is used
    if (!dryRun && !force && completedDocs.has(entry.number)) {
      console.log(`${GREEN}  Already parsed with content — skipping (use --force to re-parse)${RESET}`);
      results.push({
        entry,
        result: {
          documentId: '(existing)',
          sectionsCount: 0,
          targetsCount: 0,
          appendicesCount: 0,
          parseStatus: 'COMPLETED',
          errors: [],
          skipped: true,
          skipReason: 'Already parsed with content in DB',
        },
      });
      continue;
    }

    const options: PipelineOptions = {
      filePath,
      documentNumber: entry.number,
      documentType: entry.type ?? manifest.defaultType,
      planLevel: entry.level ?? manifest.defaultLevel,
      issuingBody: entry.body ?? manifest.defaultBody,
      issuedDate: new Date(entry.date),
      signedBy: entry.signedBy,
      useLLM,
      dryRun,
    };

    try {
      const result = await runPipeline(options);
      results.push({ entry, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${RED}Fatal error: ${msg}${RESET}`);
      results.push({
        entry,
        result: {
          documentId: '',
          sectionsCount: 0,
          targetsCount: 0,
          appendicesCount: 0,
          parseStatus: 'FAILED',
          errors: [msg],
          skipped: true,
          skipReason: msg,
        },
      });
    }
  }

  // Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successful = results.filter(r => r.result.parseStatus === 'COMPLETED');
  const failed = results.filter(r => r.result.parseStatus === 'FAILED');
  const skippedResults = results.filter(r => r.result.skipped);

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`${BOLD} BATCH SUMMARY${RESET}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`${BLUE} Total:${RESET}      ${entries.length} files`);
  console.log(`${GREEN} Success:${RESET}    ${successful.length}`);
  console.log(`${YELLOW} Skipped:${RESET}    ${skippedResults.length}`);
  console.log(`${RED} Failed:${RESET}     ${failed.length - skippedResults.length}`);
  console.log(`${BLUE} Time:${RESET}       ${elapsed}s`);

  // Totals
  const totalSections = results.reduce((sum, r) => sum + r.result.sectionsCount, 0);
  const totalTargets = results.reduce((sum, r) => sum + r.result.targetsCount, 0);
  const totalAppendices = results.reduce((sum, r) => sum + r.result.appendicesCount, 0);
  console.log(`\n${BLUE} Total sections:${RESET}    ${totalSections}`);
  console.log(`${BLUE} Total KPI targets:${RESET} ${totalTargets}`);
  console.log(`${BLUE} Total appendices:${RESET}  ${totalAppendices}`);

  // Details for each file
  console.log(`\n${DIM}${'─'.repeat(70)}${RESET}`);
  console.log(`${DIM} Document Number        │ Sections │ KPIs │ Status${RESET}`);
  console.log(`${DIM}${'─'.repeat(70)}${RESET}`);

  for (const { entry, result } of results) {
    const num = entry.number.padEnd(22);
    const sec = String(result.sectionsCount).padStart(8);
    const kpi = String(result.targetsCount).padStart(5);
    const status = result.skipped
      ? `${YELLOW}SKIPPED${RESET}`
      : result.parseStatus === 'COMPLETED'
        ? `${GREEN}OK${RESET}`
        : `${RED}FAILED${RESET}`;
    console.log(` ${num} │ ${sec} │ ${kpi} │ ${status}`);
  }

  console.log(`${DIM}${'─'.repeat(70)}${RESET}`);

  // List errors
  const allErrors = results.flatMap(r => r.result.errors.map(e => ({
    doc: r.entry.number,
    error: e,
  })));

  if (allErrors.length > 0) {
    console.log(`\n${YELLOW} Errors (${allErrors.length}):${RESET}`);
    allErrors.forEach((e, i) => {
      console.log(`  ${YELLOW}${i + 1}.${RESET} [${e.doc}] ${e.error.substring(0, 150)}`);
    });
  }

  console.log(`\n${'='.repeat(70)}\n`);

  // Exit with error if any failed
  if (failed.length > skippedResults.length) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${RED}Fatal: ${err instanceof Error ? err.message : String(err)}${RESET}`);
  process.exit(1);
});
