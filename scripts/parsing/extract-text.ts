/**
 * Text extraction module for Vietnamese government plan documents.
 *
 * Supports:
 *  - DOCX (via mammoth)
 *  - PDF (via pdf-parse v2)
 *  - DOC (binary .doc → LibreOffice headless conversion to DOCX, then mammoth)
 *  - Image-scanned PDFs (fallback: pdftoppm + Tesseract OCR)
 *
 * Handles Vietnamese Unicode (UTF-8) properly.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SupportedExtension = ".doc" | ".docx" | ".pdf";

const SUPPORTED_EXTENSIONS = new Set<string>([".doc", ".docx", ".pdf"]);

function resolveAndValidate(filePath: string): {
  absolutePath: string;
  ext: SupportedExtension;
} {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file type "${ext}". Supported types: DOC, DOCX, PDF.`,
    );
  }

  return { absolutePath, ext: ext as SupportedExtension };
}

// ---------------------------------------------------------------------------
// LibreOffice .doc → .docx conversion
// ---------------------------------------------------------------------------

/** Check if LibreOffice CLI (soffice) is available. */
let _libreOfficeAvailable: boolean | null = null;
let _libreOfficePath: string = '';

function isLibreOfficeAvailable(): boolean {
  if (_libreOfficeAvailable !== null) return _libreOfficeAvailable;

  // Common LibreOffice paths on macOS
  const candidates = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/local/bin/soffice',
    '/opt/homebrew/bin/soffice',
    'soffice', // PATH fallback
  ];

  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" --version`, { stdio: 'pipe', timeout: 10000 });
      _libreOfficePath = candidate;
      _libreOfficeAvailable = true;
      return true;
    } catch {
      // Not found at this path
    }
  }

  _libreOfficeAvailable = false;
  return false;
}

/**
 * Convert a binary .doc file to .docx using LibreOffice headless mode.
 * Returns the path to the temporary .docx file.
 * Caller is responsible for cleanup.
 */
function convertDocToDocx(absolutePath: string): string {
  if (!isLibreOfficeAvailable()) {
    throw new Error(
      'LibreOffice is not installed. Install it via: brew install --cask libreoffice',
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-convert-'));
  const baseName = path.basename(absolutePath, path.extname(absolutePath));

  try {
    console.log(`[extract-text] Converting .doc to .docx via LibreOffice...`);

    execSync(
      `"${_libreOfficePath}" --headless --convert-to docx "${absolutePath}" --outdir "${tmpDir}"`,
      {
        timeout: 120000,
        stdio: 'pipe',
      },
    );

    const docxPath = path.join(tmpDir, baseName + '.docx');

    if (!fs.existsSync(docxPath)) {
      // LibreOffice sometimes changes the filename slightly; scan directory
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.docx'));
      if (files.length > 0) {
        return path.join(tmpDir, files[0]);
      }
      throw new Error(`LibreOffice conversion produced no .docx file in ${tmpDir}`);
    }

    console.log(`[extract-text] Converted successfully: ${docxPath}`);
    return docxPath;
  } catch (err) {
    // Cleanup on failure
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// OCR for image-scanned PDFs (pdftoppm + Tesseract)
// ---------------------------------------------------------------------------

/** Check if Tesseract CLI is available. */
let _tesseractAvailable: boolean | null = null;

function isTesseractAvailable(): boolean {
  if (_tesseractAvailable !== null) return _tesseractAvailable;

  try {
    execSync('tesseract --version', { stdio: 'pipe', timeout: 5000 });
    _tesseractAvailable = true;
    return true;
  } catch {
    _tesseractAvailable = false;
    return false;
  }
}

/** Check if pdftoppm (from poppler) is available. */
let _pdftoppmAvailable: boolean | null = null;

function isPdftoppmAvailable(): boolean {
  if (_pdftoppmAvailable !== null) return _pdftoppmAvailable;

  try {
    execSync('pdftoppm -v', { stdio: 'pipe', timeout: 5000 });
    _pdftoppmAvailable = true;
    return true;
  } catch {
    _pdftoppmAvailable = false;
    return false;
  }
}

/**
 * Extract text from an image-scanned PDF using OCR.
 *
 * Process: PDF → images (pdftoppm) → OCR per page (Tesseract with vie+eng).
 *
 * @param absolutePath - Path to the PDF file.
 * @param maxPages - Maximum number of pages to OCR (default: 100).
 * @returns The OCR-extracted text.
 */
export async function extractPdfTextWithOcr(
  absolutePath: string,
  maxPages: number = 100,
): Promise<string> {
  if (!isPdftoppmAvailable()) {
    throw new Error(
      'pdftoppm (poppler) is not installed. Install it via: brew install poppler',
    );
  }

  if (!isTesseractAvailable()) {
    throw new Error(
      'Tesseract OCR is not installed. Install it via: brew install tesseract tesseract-lang',
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ocr-'));

  try {
    console.log(`[extract-text] OCR: Converting PDF pages to images (300 DPI)...`);

    // Convert PDF to PNG images at 300 DPI
    execSync(
      `pdftoppm -png -r 300 -l ${maxPages} "${absolutePath}" "${tmpDir}/page"`,
      {
        timeout: 600000,  // 10 minutes for large PDFs
        stdio: 'pipe',
      },
    );

    // Get all page images, sorted
    const pages = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    console.log(`[extract-text] OCR: ${pages.length} pages to process...`);

    if (pages.length === 0) {
      throw new Error('pdftoppm produced no page images');
    }

    // Run Tesseract on each page
    const texts: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      const imgPath = path.join(tmpDir, pages[i]);

      try {
        const text = execSync(
          `tesseract "${imgPath}" stdout -l vie+eng --psm 6`,
          {
            timeout: 60000,  // 1 minute per page
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,  // 10MB buffer
          },
        );

        texts.push(text);

        // Progress reporting every 10 pages
        if ((i + 1) % 10 === 0 || i === pages.length - 1) {
          console.log(`[extract-text] OCR: ${i + 1}/${pages.length} pages done`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[extract-text] OCR warning: page ${i + 1} failed: ${msg.substring(0, 100)}`);
        texts.push(''); // Empty text for failed pages
      }
    }

    return texts.join('\n\n');
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  }
}

// ---------------------------------------------------------------------------
// PDF extraction
// ---------------------------------------------------------------------------

async function extractPdfText(absolutePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(absolutePath);

  const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
  const result = await parser.getText();

  return result.text;
}

// ---------------------------------------------------------------------------
// DOC / DOCX extraction — plain text
// ---------------------------------------------------------------------------

function logMammothWarnings(absolutePath: string, messages: Array<{ type: string; message: string }>) {
  const warnings = messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  if (warnings.length > 0) {
    console.warn(
      `[extract-text] Warnings for ${path.basename(absolutePath)}:`,
    );
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }
}

async function extractDocText(absolutePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: absolutePath });

    if (result.messages && result.messages.length > 0) {
      logMammothWarnings(absolutePath, result.messages);
    }

    return result.value;
  } catch (error: unknown) {
    const ext = path.extname(absolutePath).toLowerCase();
    const msg = error instanceof Error ? error.message : String(error);

    // Detect old binary .doc format (not a zip file)
    if (ext === ".doc" && msg.includes("zip")) {
      // Try LibreOffice conversion as fallback
      if (isLibreOfficeAvailable()) {
        console.log(`[extract-text] Binary .doc detected — trying LibreOffice conversion...`);
        const tmpDocx = convertDocToDocx(absolutePath);

        try {
          const result = await mammoth.extractRawText({ path: tmpDocx });

          if (result.messages && result.messages.length > 0) {
            logMammothWarnings(absolutePath, result.messages);
          }

          return result.value;
        } finally {
          // Cleanup temp file
          try {
            const tmpDir = path.dirname(tmpDocx);
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch { /* ignore */ }
        }
      }

      throw new Error(
        `Cannot read "${path.basename(absolutePath)}": this appears to be an old binary ` +
        `.doc file. Mammoth only supports the modern DOCX (Office Open XML) format. ` +
        `Install LibreOffice for automatic conversion: brew install --cask libreoffice`,
      );
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// DOC / DOCX extraction — HTML (preserves heading structure)
// ---------------------------------------------------------------------------

async function extractDocHtml(absolutePath: string): Promise<string> {
  try {
    const result = await mammoth.convertToHtml({ path: absolutePath });

    if (result.messages && result.messages.length > 0) {
      logMammothWarnings(absolutePath, result.messages);
    }

    return result.value;
  } catch (error: unknown) {
    const ext = path.extname(absolutePath).toLowerCase();
    const msg = error instanceof Error ? error.message : String(error);

    if (ext === ".doc" && msg.includes("zip")) {
      // Try LibreOffice conversion as fallback
      if (isLibreOfficeAvailable()) {
        console.log(`[extract-text] Binary .doc detected — trying LibreOffice conversion for HTML...`);
        const tmpDocx = convertDocToDocx(absolutePath);

        try {
          const result = await mammoth.convertToHtml({ path: tmpDocx });

          if (result.messages && result.messages.length > 0) {
            logMammothWarnings(absolutePath, result.messages);
          }

          return result.value;
        } finally {
          try {
            const tmpDir = path.dirname(tmpDocx);
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch { /* ignore */ }
        }
      }

      throw new Error(
        `Cannot read "${path.basename(absolutePath)}": this appears to be an old binary ` +
        `.doc file. Mammoth only supports the modern DOCX (Office Open XML) format. ` +
        `Install LibreOffice for automatic conversion: brew install --cask libreoffice`,
      );
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract raw plain text from a DOC, DOCX, or PDF file.
 *
 * Paragraph structure is preserved as newline-separated text.
 * Vietnamese Unicode characters are handled via UTF-8.
 *
 * For binary .doc files, LibreOffice is used for automatic conversion
 * to DOCX if available.
 *
 * @param filePath - Path to the document (absolute or relative).
 * @returns The extracted text content.
 */
export async function extractText(filePath: string): Promise<string> {
  const { absolutePath, ext } = resolveAndValidate(filePath);

  switch (ext) {
    case ".doc":
    case ".docx":
      return extractDocText(absolutePath);
    case ".pdf":
      return extractPdfText(absolutePath);
    default:
      throw new Error(`Unhandled extension: ${ext}`);
  }
}

/**
 * Extract text with HTML markup from a DOC/DOCX file.
 *
 * Uses mammoth.convertToHtml() which preserves heading structure
 * (h1, h2, h3...), bold, italic, lists, etc.
 *
 * For binary .doc files, LibreOffice is used for automatic conversion
 * to DOCX if available.
 *
 * For PDF files this falls back to plain text extraction since
 * PDFs do not have native heading semantics.
 *
 * @param filePath - Path to the document (absolute or relative).
 * @returns HTML string (for DOC/DOCX) or plain text (for PDF).
 */
export async function extractTextWithHtml(filePath: string): Promise<string> {
  const { absolutePath, ext } = resolveAndValidate(filePath);

  switch (ext) {
    case ".doc":
    case ".docx":
      return extractDocHtml(absolutePath);
    case ".pdf":
      // PDF does not have semantic heading structure; return plain text.
      return extractPdfText(absolutePath);
    default:
      throw new Error(`Unhandled extension: ${ext}`);
  }
}
