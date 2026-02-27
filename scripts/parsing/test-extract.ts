/**
 * Quick test script for the text extraction module.
 *
 * Usage:
 *   npx tsx scripts/parsing/test-extract.ts "path/to/file.docx"
 *   npx tsx scripts/parsing/test-extract.ts "path/to/file.pdf"
 *   npx tsx scripts/parsing/test-extract.ts "path/to/file.docx" --html
 *
 * Options:
 *   --html   Use extractTextWithHtml (preserves heading structure for DOC/DOCX)
 */

import { extractText, extractTextWithHtml } from "./extract-text";

const PREVIEW_LENGTH = 2000;

async function main() {
  const args = process.argv.slice(2);
  const useHtml = args.includes("--html");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: npx tsx scripts/parsing/test-extract.ts <file-path> [--html]");
    process.exit(1);
  }

  console.log(`\nFile:   ${filePath}`);
  console.log(`Mode:   ${useHtml ? "HTML (extractTextWithHtml)" : "Plain text (extractText)"}`);
  console.log("─".repeat(60));

  try {
    const text = useHtml
      ? await extractTextWithHtml(filePath)
      : await extractText(filePath);

    const preview = text.slice(0, PREVIEW_LENGTH);
    console.log(preview);

    if (text.length > PREVIEW_LENGTH) {
      console.log(`\n... (truncated — showing ${PREVIEW_LENGTH} of ${text.length} characters)`);
    } else {
      console.log(`\n(Total: ${text.length} characters)`);
    }
  } catch (error) {
    console.error("\nExtraction failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
