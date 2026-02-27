/**
 * Mapping between evaluation report items (PY-01~PY-11) and
 * plan document sections based on keyword matching.
 *
 * Used to show relevant plan content alongside evaluation items.
 */

import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";

/* ------------------------------------------------------------------ */
/*  Keyword Mapping                                                    */
/* ------------------------------------------------------------------ */

/**
 * Keywords for matching plan sections to evaluation items.
 * Matching is case-insensitive against section titleVi and contentVi.
 */
const EVALUATION_SECTION_KEYWORDS: Record<string, string[]> = {
  // 55.1: Tổng hợp đánh giá tình hình phát triển KT-XH
  "PY-01": [
    "kinh tế",
    "xã hội",
    "tăng trưởng",
    "GDP",
    "phát triển kinh tế",
    "thu nhập",
    "GRDP",
    "cơ cấu kinh tế",
    "phát triển các ngành",
    "không gian phát triển",
  ],
  // 55.2: Hệ thống đô thị, nông thôn và khu chức năng
  "PY-02": [
    "đô thị",
    "nông thôn",
    "đô thị hóa",
    "tỷ lệ đô thị",
    "hệ thống đô thị",
    "nông thôn mới",
    "khu chức năng",
    "khu công nghiệp",
    "khu kinh tế",
  ],
  // 55.3: Tình hình sử dụng đất
  "PY-03": [
    "sử dụng đất",
    "đất nông nghiệp",
    "đất phi nông nghiệp",
    "quy hoạch đất",
    "đất ở",
    "đất lâm nghiệp",
  ],
  // 55.4: Kết quả triển khai dự án quan trọng
  "PY-04": [
    "dự án",
    "công trình",
    "dự án trọng điểm",
    "dự án ưu tiên",
    "dự án quan trọng",
    "chương trình",
    "triển khai dự án",
  ],
  // 55.5: Tài nguyên, môi trường, thiên tai và BĐKH
  "PY-05": [
    "tài nguyên",
    "môi trường",
    "bảo vệ môi trường",
    "ô nhiễm",
    "khoáng sản",
    "tài nguyên nước",
    "xử lý chất thải",
    "bảo tồn thiên nhiên",
    "đa dạng sinh học",
    "thiên tai",
    "biến đổi khí hậu",
    "phòng chống thiên tai",
    "ứng phó",
  ],
  // 55.6: Huy động nguồn lực thực hiện quy hoạch
  "PY-06": [
    "nguồn lực",
    "vốn",
    "ngân sách",
    "tài chính",
    "huy động",
    "đầu tư",
    "ODA",
    "vốn nhà nước",
    "nhân lực",
  ],
  // 55.7: Giải pháp triển khai thực hiện quy hoạch
  "PY-07": [
    "giải pháp",
    "chương trình hành động",
    "triển khai thực hiện",
    "cơ chế",
    "chính sách",
    "ban hành",
    "biện pháp",
    "tổ chức thực hiện",
  ],
  // 55.8: Kết quả thực hiện mục tiêu, chỉ tiêu
  "PY-08": [
    "mục tiêu",
    "chỉ tiêu",
    "chỉ số",
    "mục tiêu cụ thể",
    "mục tiêu tổng quát",
    "dự báo",
    "mức độ đạt",
  ],
  // 55.9: Khó khăn, vướng mắc và nguyên nhân
  "PY-09": [
    "khó khăn",
    "vướng mắc",
    "nguyên nhân",
    "tồn tại",
    "hạn chế",
    "ảnh hưởng",
  ],
  // 55.10: Đề xuất giải pháp nâng cao hiệu quả
  "PY-10": [
    "nâng cao hiệu quả",
    "đề xuất giải pháp",
    "cải thiện",
    "hiệu quả triển khai",
    "giải pháp",
  ],
  // 55.11: Kiến nghị điều chỉnh quy hoạch
  "PY-11": [
    "điều chỉnh",
    "kiến nghị",
    "đề xuất",
    "sửa đổi",
    "bổ sung",
    "điều chỉnh quy hoạch",
  ],
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MatchingSection {
  id: string;
  level: string;
  sectionNumber: string;
  titleVi: string | null;
  contentVi: string | null;
  relevanceScore: number;
  matchedKeywords: string[];
}

export interface MatchingResult {
  sections: MatchingSection[];
  targets?: Array<{
    id: string;
    targetType: string;
    nameVi: string;
    unit: string | null;
    targetValue: string | number | null;
    targetYear: number | null;
    targetMin: string | number | null;
    targetMax: string | number | null;
  }>;
  appendices?: Array<{
    id: string;
    titleVi: string;
    appendixType: string;
    _count: { rows: number };
  }>;
}

/* ------------------------------------------------------------------ */
/*  Query Function                                                     */
/* ------------------------------------------------------------------ */

/**
 * Find plan sections that match a specific evaluation item code.
 *
 * @param planId - The plan UUID
 * @param itemCode - Evaluation item code (e.g., "PY-01")
 * @returns Matching sections sorted by relevance
 */
export async function getMatchingSections(
  planId: string,
  itemCode: string,
): Promise<MatchingResult> {
  const keywords = EVALUATION_SECTION_KEYWORDS[itemCode];
  if (!keywords) {
    return { sections: [] };
  }

  // Fetch all sections for this plan's document
  const doc = await prisma.planDocument.findUnique({
    where: { planId },
    select: { id: true },
  });

  if (!doc) {
    return { sections: [] };
  }

  // Get sections with content (only DIEU and ROMAN level for relevance)
  const allSections = await prisma.planSection.findMany({
    where: {
      documentId: doc.id,
      level: { in: ["DIEU", "ROMAN", "ARABIC"] },
    },
    select: {
      id: true,
      level: true,
      sectionNumber: true,
      titleVi: true,
      contentVi: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  // Score each section by keyword matching
  const scored: MatchingSection[] = [];

  for (const section of allSections) {
    const searchText = [
      section.titleVi ?? "",
      section.contentVi ?? "",
    ]
      .join(" ")
      .toLowerCase();

    const matchedKeywords: string[] = [];

    for (const kw of keywords) {
      if (searchText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }

    if (matchedKeywords.length > 0) {
      // Title matches worth more than content matches
      let score = matchedKeywords.length;
      for (const kw of matchedKeywords) {
        if ((section.titleVi ?? "").toLowerCase().includes(kw.toLowerCase())) {
          score += 2; // Bonus for title match
        }
      }

      scored.push({
        id: section.id,
        level: section.level,
        sectionNumber: section.sectionNumber,
        titleVi: section.titleVi,
        contentVi: section.contentVi,
        relevanceScore: score,
        matchedKeywords,
      });
    }
  }

  // Sort by relevance (highest first)
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Limit to top 10 most relevant sections
  const topSections = scored.slice(0, 10);

  const result: MatchingResult = { sections: topSections };

  // For PY-04 (55.4 major projects), also fetch appendices with PROJECT_LIST type
  if (itemCode === "PY-04") {
    const appendices = await prisma.planAppendix.findMany({
      where: {
        documentId: doc.id,
        appendixType: "PROJECT_LIST",
      },
      select: {
        id: true,
        titleVi: true,
        appendixType: true,
        _count: { select: { rows: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
    result.appendices = serialize(appendices);
  }

  // For PY-08 (55.8 targets/indicators), also fetch PlanTarget data
  if (itemCode === "PY-08") {
    const targets = await prisma.planTarget.findMany({
      where: {
        section: { documentId: doc.id },
        targetType: "QUANTITATIVE",
      },
      select: {
        id: true,
        targetType: true,
        nameVi: true,
        unit: true,
        targetValue: true,
        targetYear: true,
        targetMin: true,
        targetMax: true,
      },
      orderBy: { sortOrder: "asc" },
      take: 30,
    });
    result.targets = serialize(targets);
  }

  return result;
}
