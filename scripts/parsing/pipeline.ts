/**
 * Main pipeline orchestrator for parsing Vietnamese government plan documents.
 *
 * Ties together all parsing modules:
 *  - extract-text:    DOC/DOCX/PDF text extraction
 *  - parse-structure: Rule-based section parser
 *  - extract-targets: KPI/target extraction from section content
 *  - parse-appendix:  Appendix table parser
 *
 * Then persists the parsed data to the database via Prisma.
 *
 * Usage:
 *   import { runPipeline } from './pipeline';
 *   const result = await runPipeline({ filePath: '...', ... });
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

import { extractText, extractTextWithHtml, extractPdfTextWithOcr } from './extract-text';
import { parseStructure, flattenSections } from './parse-structure';
import type { ParsedSection, ParsedDocument } from './parse-structure';
import { parseAppendices, parseAppendicesFromHtml } from './parse-appendix';
import type { ParsedAppendix } from './parse-appendix';
import { extractTargets } from './extract-targets';
import type { ExtractedTarget } from './extract-targets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  filePath: string;           // Path to DOC/DOCX/PDF file
  planId?: string;            // Existing Plan UUID to link to (optional)
  documentNumber: string;     // e.g. "81/2023/QH15"
  documentType: 'NGHI_QUYET' | 'QUYET_DINH';
  planLevel?: 'NATIONAL' | 'REGIONAL' | 'SECTOR' | 'PROVINCE';  // Plan hierarchy level
  issuingBody: string;        // e.g. "Quoc hoi"
  issuedDate: Date;
  signedBy?: string;
  useLLM?: boolean;           // Use LLM for KPI extraction
  dryRun?: boolean;           // Don't save to DB, just print results
}

export interface PipelineResult {
  documentId: string;
  sectionsCount: number;
  targetsCount: number;
  appendicesCount: number;
  parseStatus: 'COMPLETED' | 'FAILED';
  errors: string[];
  skipped?: boolean;          // true if file couldn't be parsed (e.g., image PDF)
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimum "meaningful" text length to consider a document successfully extracted.
 * Image-scanned PDFs often have 200-800 chars of page markers ("-- 1 of 43 --")
 * but no actual content. We count only non-whitespace, non-page-marker text.
 */
const MIN_TEXT_LENGTH = 500;

/**
 * Count "meaningful" text characters — strips page markers, whitespace, etc.
 * Image-scanned PDFs often produce text like "-- 1 of 43 --\n" per page,
 * which inflates raw text length without containing real content.
 */
function meaningfulTextLength(text: string): number {
  // Remove common pdf-parse page markers: "-- 1 of 43 --"
  const stripped = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length;
}

/**
 * Resolve the best file to parse from a given path.
 * - If the file is a binary .doc, look for a .pdf or .docx in the same directory
 * - If the file is a .pdf or .docx, use it directly
 * Returns the resolved file path and what was tried.
 */
function resolveFile(filePath: string): { resolvedPath: string; note: string } {
  const absPath = path.resolve(filePath);
  const ext = path.extname(absPath).toLowerCase();
  const dir = path.dirname(absPath);
  const baseName = path.basename(absPath, ext);

  // DOCX and PDF are directly usable
  if (ext === '.docx' || ext === '.pdf') {
    return { resolvedPath: absPath, note: `Using ${ext} directly` };
  }

  // For .doc (binary), try alternatives in order: .pdf > .docx > direct .doc (LibreOffice)
  if (ext === '.doc') {
    // Try PDF with same base name
    const pdfPath = path.join(dir, baseName + '.pdf');
    if (fs.existsSync(pdfPath)) {
      return { resolvedPath: pdfPath, note: `Binary .doc → using .pdf instead` };
    }

    // Try DOCX with same base name
    const docxPath = path.join(dir, baseName + '.docx');
    if (fs.existsSync(docxPath)) {
      return { resolvedPath: docxPath, note: `Binary .doc → using .docx instead` };
    }

    // No alternatives — use .doc directly (LibreOffice will auto-convert in extract-text)
    return { resolvedPath: absPath, note: `Binary .doc — will use LibreOffice conversion` };
  }

  return { resolvedPath: absPath, note: `Unknown extension ${ext}` };
}

/**
 * Recursively count all sections in a ParsedSection tree.
 */
function countSections(sections: ParsedSection[]): number {
  let count = 0;
  for (const s of sections) {
    count += 1;
    count += countSections(s.children);
  }
  return count;
}

/**
 * Collect leaf sections (no children) that have non-empty content.
 * These are the sections we attempt KPI extraction on.
 */
function collectLeafSections(sections: ParsedSection[]): ParsedSection[] {
  const leaves: ParsedSection[] = [];

  function walk(secs: ParsedSection[]): void {
    for (const s of secs) {
      if (s.children.length === 0 && s.contentVi.trim().length > 0) {
        leaves.push(s);
      }
      walk(s.children);
    }
  }

  walk(sections);
  return leaves;
}

// ---------------------------------------------------------------------------
// DB save helpers (bulk insert with client-side UUID generation)
// ---------------------------------------------------------------------------

interface FlatSectionRecord {
  id: string;
  documentId: string;
  parentId: string | null;
  level: string;
  sectionNumber: string;
  titleVi: string | null;
  contentVi: string | null;
  sortOrder: number;
  metadata: Prisma.InputJsonValue | undefined;
}

/**
 * Flatten sections into bulk-insertable records with pre-generated UUIDs.
 * Returns both the flat records array and an idMap for linking targets.
 */
function prepareSectionRecords(
  documentId: string,
  sections: ParsedSection[],
  parentId: string | null,
): { records: FlatSectionRecord[]; idMap: Map<string, string> } {
  const records: FlatSectionRecord[] = [];
  const idMap = new Map<string, string>();

  function walk(secs: ParsedSection[], pId: string | null): void {
    for (const section of secs) {
      const id = crypto.randomUUID();
      const key = `${section.level}:${section.sectionNumber}:${section.sortOrder}`;
      idMap.set(key, id);

      records.push({
        id,
        documentId,
        parentId: pId,
        level: section.level,
        sectionNumber: section.sectionNumber,
        titleVi: section.titleVi || null,
        contentVi: section.contentVi || null,
        sortOrder: section.sortOrder,
        metadata: (section.metadata as Prisma.InputJsonValue) ?? undefined,
      });

      if (section.children.length > 0) {
        walk(section.children, id);
      }
    }
  }

  walk(sections, parentId);
  return { records, idMap };
}

/** Batch size for createMany operations to stay within Supabase limits. */
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const errors: string[] = [];

  // ------------------------------------------------------------------
  // Step 0: Resolve file (auto-switch binary .doc → .pdf/.docx)
  // ------------------------------------------------------------------

  const { resolvedPath, note: resolveNote } = resolveFile(options.filePath);
  const sourceFileName = path.basename(options.filePath); // Keep original name for DB record
  const actualFile = resolvedPath;

  console.log(`\n[pipeline] Starting parse for: ${sourceFileName}`);
  if (resolvedPath !== path.resolve(options.filePath)) {
    console.log(`[pipeline] File resolved: ${resolveNote}`);
    console.log(`[pipeline]   Using: ${path.basename(actualFile)}`);
  }
  console.log(`[pipeline] Document: ${options.documentNumber} (${options.documentType})`);
  console.log(`[pipeline] Issuing body: ${options.issuingBody}`);

  // Check if the resolved file actually exists
  if (!fs.existsSync(actualFile)) {
    console.error(`[pipeline] ERROR: File not found: ${actualFile}`);
    return {
      documentId: '',
      sectionsCount: 0,
      targetsCount: 0,
      appendicesCount: 0,
      parseStatus: 'FAILED',
      errors: [`File not found: ${actualFile}`],
      skipped: true,
      skipReason: `File not found: ${actualFile}`,
    };
  }

  // ------------------------------------------------------------------
  // Step 1: Extract text
  // ------------------------------------------------------------------

  let rawText = '';
  let htmlText = '';

  console.log('[pipeline] Step 1/5: Extracting text...');

  try {
    rawText = await extractText(actualFile);
    console.log(`[pipeline]   Plain text: ${rawText.length} characters`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Text extraction failed: ${msg}`);
    console.error(`[pipeline]   ERROR: ${msg}`);
  }

  // Try HTML extraction for DOC/DOCX (better table parsing)
  const ext = path.extname(actualFile).toLowerCase();
  if (ext === '.doc' || ext === '.docx') {
    try {
      htmlText = await extractTextWithHtml(actualFile);
      console.log(`[pipeline]   HTML text: ${htmlText.length} characters`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Not fatal — HTML extraction is a nice-to-have for appendices
      console.warn(`[pipeline]   HTML extraction warning: ${msg}`);
    }
  }

  // Check if extracted text is too short (likely image-scanned PDF)
  // Use meaningfulTextLength to strip page markers that inflate raw length
  const meaningfulLen = meaningfulTextLength(rawText);

  if (meaningfulLen < MIN_TEXT_LENGTH) {
    const actualExt = path.extname(actualFile).toLowerCase();

    if (actualExt === '.pdf') {
      console.warn(`[pipeline]   Meaningful text is only ${meaningfulLen} chars (raw: ${rawText.length}) — trying OCR fallback...`);

      try {
        rawText = await extractPdfTextWithOcr(actualFile);
        const ocrMeaningful = meaningfulTextLength(rawText);
        console.log(`[pipeline]   OCR extracted: ${rawText.length} characters (meaningful: ${ocrMeaningful})`);
        errors.push(`Used OCR fallback (original text too short: ${meaningfulLen} meaningful chars).`);
      } catch (ocrErr) {
        const ocrMsg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
        console.error(`[pipeline]   OCR failed: ${ocrMsg}`);
        errors.push(`OCR fallback failed: ${ocrMsg}`);
      }
    }

    // Still too short after OCR attempt?
    const finalLen = meaningfulTextLength(rawText);
    if (finalLen < MIN_TEXT_LENGTH) {
      console.warn(`[pipeline]   Text still only ${finalLen} meaningful chars after all extraction attempts.`);
      return {
        documentId: '',
        sectionsCount: 0,
        targetsCount: 0,
        appendicesCount: 0,
        parseStatus: 'FAILED',
        errors: [...errors, `Extracted text too short (${finalLen} meaningful chars) even after OCR attempt.`],
        skipped: true,
        skipReason: `Extracted text too short (${finalLen} meaningful chars). Neither text extraction nor OCR produced usable content.`,
      };
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Parse structure
  // ------------------------------------------------------------------

  let parsedDoc: ParsedDocument | null = null;

  console.log('[pipeline] Step 2/5: Parsing document structure...');

  try {
    parsedDoc = parseStructure(rawText);
    const totalSections = countSections(parsedDoc.sections);
    console.log(`[pipeline]   Top-level sections: ${parsedDoc.sections.length}`);
    console.log(`[pipeline]   Total sections (nested): ${totalSections}`);
    console.log(`[pipeline]   Preamble: ${parsedDoc.preamble.length} chars`);
    console.log(`[pipeline]   Signature block: ${parsedDoc.signatureBlock.length} chars`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Structure parsing failed: ${msg}`);
    console.error(`[pipeline]   ERROR: ${msg}`);
  }

  // ------------------------------------------------------------------
  // Step 3: Extract KPI targets
  // ------------------------------------------------------------------

  const targetsBySectionKey = new Map<string, ExtractedTarget[]>();
  let totalTargets = 0;

  console.log('[pipeline] Step 3/5: Extracting KPI targets...');

  if (parsedDoc) {
    const leaves = collectLeafSections(parsedDoc.sections);
    console.log(`[pipeline]   Leaf sections with content: ${leaves.length}`);

    for (const leaf of leaves) {
      try {
        const targets = await extractTargets(leaf.contentVi, {
          useLLM: options.useLLM ?? false,
        });

        if (targets.length > 0) {
          const key = `${leaf.level}:${leaf.sectionNumber}:${leaf.sortOrder}`;
          targetsBySectionKey.set(key, targets);
          totalTargets += targets.length;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Target extraction failed for [${leaf.level} ${leaf.sectionNumber}]: ${msg}`);
        console.warn(`[pipeline]   Warning: target extraction failed for [${leaf.level} ${leaf.sectionNumber}]: ${msg}`);
      }
    }

    console.log(`[pipeline]   Total KPI targets found: ${totalTargets}`);
  } else {
    console.log('[pipeline]   Skipped (no parsed structure).');
  }

  // ------------------------------------------------------------------
  // Step 4: Parse appendices
  // ------------------------------------------------------------------

  let appendices: ParsedAppendix[] = [];

  console.log('[pipeline] Step 4/5: Parsing appendices...');

  try {
    // Prefer HTML parsing for DOC/DOCX (better table structure)
    if (htmlText.length > 0) {
      appendices = parseAppendicesFromHtml(htmlText);
      console.log(`[pipeline]   Parsed from HTML: ${appendices.length} appendices`);
    } else {
      appendices = parseAppendices(rawText);
      console.log(`[pipeline]   Parsed from plain text: ${appendices.length} appendices`);
    }

    const totalRows = appendices.reduce((sum, a) => sum + a.rows.length, 0);
    console.log(`[pipeline]   Total appendix rows: ${totalRows}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Appendix parsing failed: ${msg}`);
    console.error(`[pipeline]   ERROR: ${msg}`);
  }

  // ------------------------------------------------------------------
  // Step 5: Save to DB (or dry run)
  // ------------------------------------------------------------------

  const sectionsCount = parsedDoc ? countSections(parsedDoc.sections) : 0;
  const appendicesCount = appendices.length;
  const totalAppendixRows = appendices.reduce((sum, a) => sum + a.rows.length, 0);

  if (options.dryRun) {
    console.log('[pipeline] Step 5/5: Dry run — skipping DB save.');
    console.log('\n[pipeline] === DRY RUN SUMMARY ===');
    console.log(JSON.stringify({
      documentNumber: options.documentNumber,
      documentType: options.documentType,
      issuingBody: options.issuingBody,
      sourceFileName,
      sectionsCount,
      targetsCount: totalTargets,
      appendicesCount,
      totalAppendixRows,
      errors,
      sections: parsedDoc ? flattenSections(parsedDoc.sections).map(s => ({
        level: s.level,
        sectionNumber: s.sectionNumber,
        titleVi: s.titleVi,
        contentLength: s.contentVi.length,
        depth: s.depth,
      })) : [],
      targets: Array.from(targetsBySectionKey.entries()).map(([key, targets]) => ({
        sectionKey: key,
        targets: targets.map(t => ({
          targetType: t.targetType,
          nameVi: t.nameVi,
          unit: t.unit,
          targetValue: t.targetValue,
          targetYear: t.targetYear,
        })),
      })),
      appendices: appendices.map(a => ({
        appendixNumber: a.appendixNumber,
        titleVi: a.titleVi,
        appendixType: a.appendixType,
        columns: a.columns,
        rowCount: a.rows.length,
      })),
    }, null, 2));

    return {
      documentId: '(dry-run)',
      sectionsCount,
      targetsCount: totalTargets,
      appendicesCount,
      parseStatus: errors.length > 0 && sectionsCount === 0 ? 'FAILED' : 'COMPLETED',
      errors,
    };
  }

  // --- Actual DB save ---

  console.log('[pipeline] Step 5/5: Saving to database...');

  const prisma = new PrismaClient();
  let documentId = '';

  try {
    // If no planId provided, we need to create a placeholder Plan first
    // because PlanDocument.planId is required in the schema.
    let planId = options.planId;

    if (!planId) {
      console.log('[pipeline]   No planId provided — creating placeholder plan...');

      // Find a PlanType matching the level
      const level = options.planLevel
        ?? (options.documentType === 'NGHI_QUYET' ? 'NATIONAL' : 'REGIONAL');
      const defaultPlanType = await prisma.planType.findFirst({
        where: { level },
      });

      if (!defaultPlanType) {
        throw new Error(
          `No PlanType found for level ${level}. ` +
          `Please seed plan types first, or provide an explicit --plan-id.`,
        );
      }

      // Find a default Organization
      const defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) {
        throw new Error('No Organization found in the database. Please seed organizations first.');
      }

      const plan = await prisma.plan.create({
        data: {
          nameVi: `[Parsed] ${options.documentNumber}`,
          planTypeId: defaultPlanType.id,
          periodStart: options.issuedDate.getFullYear(),
          periodEnd: options.issuedDate.getFullYear() + 10,
          status: 'APPROVED',
          approvedDate: options.issuedDate,
          organizationId: defaultOrg.id,
        },
      });

      planId = plan.id;
      console.log(`[pipeline]   Created placeholder plan: ${planId}`);
    }

    // Check if a PlanDocument already exists for this planId
    const existingDoc = await prisma.planDocument.findUnique({
      where: { planId },
    });

    if (existingDoc) {
      console.log(`[pipeline]   Existing PlanDocument found (${existingDoc.id}) — deleting for re-parse...`);
      // Cascade delete will remove sections, targets, appendices, appendix rows
      await prisma.planDocument.delete({
        where: { id: existingDoc.id },
      });
      console.log('[pipeline]   Deleted existing PlanDocument and related records.');
    }

    // --- Bulk insert using client-side UUIDs + createMany ---
    // This avoids transaction timeouts on remote Supabase by minimizing round trips.

    const docId = crypto.randomUUID();
    documentId = docId;

    // 1. Create PlanDocument
    await prisma.planDocument.create({
      data: {
        id: docId,
        planId: planId!,
        documentNumber: options.documentNumber,
        documentType: options.documentType,
        issuingBody: options.issuingBody,
        signedBy: options.signedBy ?? null,
        issuedDate: options.issuedDate,
        sourceFileName,
        parseStatus: 'IN_PROGRESS',
        parseErrors: errors.length > 0 ? errors : undefined,
      },
    });

    console.log(`[pipeline]   Created PlanDocument: ${docId}`);

    // 2. Bulk create PlanSections (pre-generate UUIDs for parent-child linking)
    let sectionIdMap = new Map<string, string>();

    if (parsedDoc && parsedDoc.sections.length > 0) {
      const { records: sectionRecords, idMap } = prepareSectionRecords(
        docId,
        parsedDoc.sections,
        null,
      );
      sectionIdMap = idMap;

      // Insert in batches
      for (let i = 0; i < sectionRecords.length; i += BATCH_SIZE) {
        const batch = sectionRecords.slice(i, i + BATCH_SIZE);
        await prisma.planSection.createMany({
          data: batch.map(r => ({
            id: r.id,
            documentId: r.documentId,
            parentId: r.parentId,
            level: r.level as any,
            sectionNumber: r.sectionNumber,
            titleVi: r.titleVi,
            contentVi: r.contentVi,
            sortOrder: r.sortOrder,
            metadata: r.metadata,
          })),
        });
      }

      console.log(`[pipeline]   Created ${sectionRecords.length} PlanSection records.`);
    }

    // 3. Bulk create PlanTargets linked to their sections
    const targetRecords: any[] = [];

    for (const [sectionKey, targets] of targetsBySectionKey) {
      const sectionId = sectionIdMap.get(sectionKey);

      if (!sectionId) {
        console.warn(`[pipeline]   Warning: no section ID found for key "${sectionKey}" — skipping ${targets.length} targets.`);
        continue;
      }

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        targetRecords.push({
          id: crypto.randomUUID(),
          sectionId,
          targetType: t.targetType,
          nameVi: t.nameVi,
          nameEn: t.nameEn ?? null,
          unit: t.unit ?? null,
          targetValue: t.targetValue ?? null,
          targetYear: t.targetYear ?? null,
          baselineValue: t.baselineValue ?? null,
          baselineYear: t.baselineYear ?? null,
          targetMin: t.targetMin ?? null,
          targetMax: t.targetMax ?? null,
          rawTextVi: t.rawTextVi ?? null,
          sortOrder: i + 1,
          metadata: (t.metadata as Prisma.InputJsonValue) ?? undefined,
        });
      }
    }

    if (targetRecords.length > 0) {
      for (let i = 0; i < targetRecords.length; i += BATCH_SIZE) {
        const batch = targetRecords.slice(i, i + BATCH_SIZE);
        await prisma.planTarget.createMany({ data: batch });
      }
    }

    console.log(`[pipeline]   Created ${targetRecords.length} PlanTarget records.`);

    // 4. Bulk create PlanAppendices with AppendixRows
    let createdAppendices = 0;
    const allAppendixRows: any[] = [];

    for (const appendix of appendices) {
      const appendixId = crypto.randomUUID();
      await prisma.planAppendix.create({
        data: {
          id: appendixId,
          documentId: docId,
          appendixNumber: appendix.appendixNumber,
          titleVi: appendix.titleVi,
          appendixType: appendix.appendixType as any,
          sortOrder: appendix.sortOrder,
          metadata: { columns: appendix.columns },
        },
      });
      createdAppendices++;

      for (const row of appendix.rows) {
        allAppendixRows.push({
          id: crypto.randomUUID(),
          appendixId,
          rowNumber: row.rowNumber,
          data: row.data as object,
          sortOrder: row.sortOrder,
        });
      }
    }

    // Bulk insert appendix rows
    if (allAppendixRows.length > 0) {
      for (let i = 0; i < allAppendixRows.length; i += BATCH_SIZE) {
        const batch = allAppendixRows.slice(i, i + BATCH_SIZE);
        await prisma.appendixRow.createMany({ data: batch });
      }
    }

    console.log(`[pipeline]   Created ${createdAppendices} PlanAppendix records with ${allAppendixRows.length} rows.`);

    // 5. Update parse status to COMPLETED
    await prisma.planDocument.update({
      where: { id: docId },
      data: {
        parseStatus: 'COMPLETED',
        parsedAt: new Date(),
        parseErrors: errors.length > 0 ? errors : undefined,
      },
    });

    console.log(`[pipeline]   All records saved. Document ID: ${documentId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`DB save failed: ${msg}`);
    console.error(`[pipeline]   DB ERROR: ${msg}`);

    // Try to mark the document as FAILED or clean up partial writes
    if (documentId) {
      try {
        // Since we're not in a transaction, we need to clean up partial data
        // Delete the document (cascade will remove sections, targets, appendices)
        await prisma.planDocument.delete({
          where: { id: documentId },
        });
        console.log('[pipeline]   Cleaned up partial data after failure.');
        documentId = '';
      } catch {
        // Document might not have been created yet
        try {
          await prisma.planDocument.update({
            where: { id: documentId },
            data: {
              parseStatus: 'FAILED',
              parseErrors: errors,
            },
          });
        } catch {
          // Ignore
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const parseStatus = errors.length > 0 && sectionsCount === 0 ? 'FAILED' : 'COMPLETED';

  console.log(`\n[pipeline] Done. Status: ${parseStatus}`);
  if (errors.length > 0) {
    console.log(`[pipeline] Errors (${errors.length}):`);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  return {
    documentId: documentId || '(not saved)',
    sectionsCount,
    targetsCount: totalTargets,
    appendicesCount,
    parseStatus,
    errors,
  };
}
