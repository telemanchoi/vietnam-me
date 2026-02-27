#!/usr/bin/env tsx
/**
 * CLI entry point for the Vietnamese government plan document parser.
 *
 * Usage:
 *   # Parse a single document (dry run)
 *   npx tsx scripts/parsing/run-parse.ts \
 *     --file "path/to/file.pdf" \
 *     --number "81/2023/QH15" \
 *     --type NGHI_QUYET \
 *     --body "Quoc hoi" \
 *     --date "2023-01-09" \
 *     --dry-run
 *
 *   # Parse and save to DB
 *   npx tsx scripts/parsing/run-parse.ts \
 *     --file "path/to/file.pdf" \
 *     --number "81/2023/QH15" \
 *     --type NGHI_QUYET \
 *     --body "Quoc hoi" \
 *     --date "2023-01-09"
 *
 *   # Parse with LLM KPI extraction
 *   npx tsx scripts/parsing/run-parse.ts \
 *     --file "path/to/file.pdf" \
 *     --number "81/2023/QH15" \
 *     --type NGHI_QUYET \
 *     --body "Quoc hoi" \
 *     --date "2023-01-09" \
 *     --llm
 *
 * Options:
 *   --file <path>       Path to DOC/DOCX/PDF file (required)
 *   --number <str>      Document number, e.g. "81/2023/QH15" (required)
 *   --type <str>        NGHI_QUYET or QUYET_DINH (required)
 *   --body <str>        Issuing body, e.g. "Quoc hoi" (required)
 *   --date <str>        Issued date in YYYY-MM-DD format (required)
 *   --plan-id <uuid>    Existing Plan UUID to link to (optional)
 *   --signed-by <str>   Name of the signer (optional)
 *   --llm               Enable LLM-based KPI extraction (optional)
 *   --dry-run           Don't save to DB, just print results (optional)
 *   --help              Show this help message
 */

import * as path from 'path';
import { runPipeline } from './pipeline';
import type { PipelineOptions } from './pipeline';

// ---------------------------------------------------------------------------
// ANSI color helpers
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
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  file?: string;
  number?: string;
  type?: string;
  level?: string;
  body?: string;
  date?: string;
  planId?: string;
  signedBy?: string;
  llm: boolean;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    llm: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--file':
        args.file = argv[++i];
        break;
      case '--number':
        args.number = argv[++i];
        break;
      case '--type':
        args.type = argv[++i];
        break;
      case '--body':
        args.body = argv[++i];
        break;
      case '--level':
        args.level = argv[++i];
        break;
      case '--date':
        args.date = argv[++i];
        break;
      case '--plan-id':
        args.planId = argv[++i];
        break;
      case '--signed-by':
        args.signedBy = argv[++i];
        break;
      case '--llm':
        args.llm = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`${RED}Unknown option: ${arg}${RESET}`);
          process.exit(1);
        }
        break;
    }
  }

  return args;
}

function printUsage(): void {
  console.log(`
${BOLD}Vietnamese Government Plan Document Parser${RESET}

${CYAN}USAGE:${RESET}
  npx tsx scripts/parsing/run-parse.ts --file <path> --number <str> --type <str> --body <str> --date <str> [options]

${CYAN}REQUIRED:${RESET}
  --file <path>       Path to DOC/DOCX/PDF file
  --number <str>      Document number (e.g. "81/2023/QH15")
  --type <str>        Document type: NGHI_QUYET or QUYET_DINH
  --body <str>        Issuing body (e.g. "Quoc hoi")
  --date <str>        Issued date in YYYY-MM-DD format

${CYAN}OPTIONAL:${RESET}
  --plan-id <uuid>    Existing Plan UUID to link to
  --signed-by <str>   Name of the signer
  --llm               Enable LLM-based KPI extraction
  --dry-run           Don't save to DB, just print parsed results
  --help, -h          Show this help message

${CYAN}EXAMPLES:${RESET}
  ${DIM}# Dry run (preview what would be parsed)${RESET}
  npx tsx scripts/parsing/run-parse.ts \\
    --file "docs/81-2023-QH15.pdf" \\
    --number "81/2023/QH15" \\
    --type NGHI_QUYET \\
    --body "Quoc hoi" \\
    --date "2023-01-09" \\
    --dry-run

  ${DIM}# Parse and save to database${RESET}
  npx tsx scripts/parsing/run-parse.ts \\
    --file "docs/81-2023-QH15.pdf" \\
    --number "81/2023/QH15" \\
    --type NGHI_QUYET \\
    --body "Quoc hoi" \\
    --date "2023-01-09"

  ${DIM}# Link to an existing plan and use LLM extraction${RESET}
  npx tsx scripts/parsing/run-parse.ts \\
    --file "docs/81-2023-QH15.pdf" \\
    --number "81/2023/QH15" \\
    --type NGHI_QUYET \\
    --body "Quoc hoi" \\
    --date "2023-01-09" \\
    --plan-id "a1b2c3d4-..." \\
    --llm
`);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateArgs(args: CliArgs): PipelineOptions {
  const missing: string[] = [];

  if (!args.file) missing.push('--file');
  if (!args.number) missing.push('--number');
  if (!args.type) missing.push('--type');
  if (!args.body) missing.push('--body');
  if (!args.date) missing.push('--date');

  if (missing.length > 0) {
    console.error(`${RED}Missing required arguments: ${missing.join(', ')}${RESET}`);
    console.error(`Run with --help for usage information.\n`);
    process.exit(1);
  }

  // Validate document type
  const validTypes = ['NGHI_QUYET', 'QUYET_DINH'] as const;
  if (!validTypes.includes(args.type as typeof validTypes[number])) {
    console.error(`${RED}Invalid --type "${args.type}". Must be one of: ${validTypes.join(', ')}${RESET}`);
    process.exit(1);
  }

  // Validate plan level (optional)
  const validLevels = ['NATIONAL', 'REGIONAL', 'SECTOR', 'PROVINCE'] as const;
  if (args.level && !validLevels.includes(args.level as typeof validLevels[number])) {
    console.error(`${RED}Invalid --level "${args.level}". Must be one of: ${validLevels.join(', ')}${RESET}`);
    process.exit(1);
  }

  // Validate date format
  const issuedDate = new Date(args.date!);
  if (isNaN(issuedDate.getTime())) {
    console.error(`${RED}Invalid --date "${args.date}". Must be a valid date (e.g. "2023-01-09").${RESET}`);
    process.exit(1);
  }

  // Resolve file path
  const filePath = path.resolve(args.file!);

  return {
    filePath,
    planId: args.planId,
    documentNumber: args.number!,
    documentType: args.type as 'NGHI_QUYET' | 'QUYET_DINH',
    planLevel: args.level as 'NATIONAL' | 'REGIONAL' | 'SECTOR' | 'PROVINCE' | undefined,
    issuingBody: args.body!,
    issuedDate,
    signedBy: args.signedBy,
    useLLM: args.llm,
    dryRun: args.dryRun,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const options = validateArgs(args);

  // Print file info header
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${BOLD} Vietnamese Plan Document Parser${RESET}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`${BLUE} File:${RESET}     ${options.filePath}`);
  console.log(`${BLUE} Number:${RESET}   ${options.documentNumber}`);
  console.log(`${BLUE} Type:${RESET}     ${options.documentType}`);
  console.log(`${BLUE} Body:${RESET}     ${options.issuingBody}`);
  console.log(`${BLUE} Date:${RESET}     ${options.issuedDate.toISOString().split('T')[0]}`);
  if (options.planId) {
    console.log(`${BLUE} Plan ID:${RESET}  ${options.planId}`);
  }
  if (options.signedBy) {
    console.log(`${BLUE} Signed:${RESET}   ${options.signedBy}`);
  }
  console.log(`${BLUE} LLM:${RESET}     ${options.useLLM ? 'Yes' : 'No'}`);
  console.log(`${BLUE} Mode:${RESET}     ${options.dryRun ? 'DRY RUN' : 'SAVE TO DB'}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();

  try {
    const result = await runPipeline(options);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Print results summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${BOLD} Parse Results${RESET}`);
    console.log(`${'='.repeat(60)}`);

    if (result.skipped) {
      console.log(`${YELLOW} SKIPPED:${RESET}  ${result.skipReason}`);
    } else {
      console.log(`${BLUE} Sections found:${RESET}    ${result.sectionsCount}`);
      console.log(`${BLUE} KPI targets found:${RESET} ${result.targetsCount}`);
      console.log(`${BLUE} Appendices found:${RESET}  ${result.appendicesCount}`);

      if (result.parseStatus === 'COMPLETED') {
        if (options.dryRun) {
          console.log(`\n${CYAN} Dry run complete${RESET} ${DIM}(${elapsed}s)${RESET}`);
        } else {
          console.log(`\n${GREEN} Saved to DB${RESET} ${DIM}(${elapsed}s)${RESET}`);
          console.log(`${BLUE} Document ID:${RESET} ${result.documentId}`);
        }
      } else {
        console.log(`\n${RED} Parse FAILED${RESET} ${DIM}(${elapsed}s)${RESET}`);
      }
    }

    if (result.errors.length > 0) {
      console.log(`\n${YELLOW} Warnings/Errors (${result.errors.length}):${RESET}`);
      result.errors.forEach((e, i) => {
        console.log(`  ${YELLOW}${i + 1}.${RESET} ${e}`);
      });
    }

    console.log(`${'='.repeat(60)}\n`);

    // Exit with error code if failed
    if (result.parseStatus === 'FAILED' && !result.skipped) {
      process.exit(1);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n${RED}${BOLD}Fatal error:${RESET} ${msg}`);

    if (err instanceof Error && err.stack) {
      console.error(`${DIM}${err.stack}${RESET}`);
    }

    process.exit(1);
  }
}

main();
