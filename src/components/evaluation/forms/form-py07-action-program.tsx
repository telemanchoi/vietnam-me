"use client";

import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { YesNoToggle } from "./shared/yes-no-toggle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PY07Item {
  category: string;
  subField: string;
  included: boolean | null;
  includedContent: string;
  implementationChecked: boolean | null;
  checkResult: string | null; // "poor" | "fair" | "good"
  remedy: string;
  selfEvaluation: string;
}

interface PY07Data {
  items: PY07Item[];
}

interface FormPY07ActionProgramProps {
  value: Partial<PY07Data>;
  onChange: (data: PY07Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Predefined items
// ---------------------------------------------------------------------------

const DEFAULT_ITEMS: Pick<PY07Item, "category" | "subField">[] = [
  { category: "Kế hoạch huy động vốn đầu tư", subField: "Ngân sách công" },
  { category: "Kế hoạch huy động vốn đầu tư", subField: "Vốn tư nhân" },
  { category: "Kế hoạch huy động vốn đầu tư", subField: "Đầu tư nước ngoài" },
  { category: "Kế hoạch phát triển nguồn nhân lực", subField: "Tương tự" },
  { category: "Kế hoạch bền vững môi trường", subField: "Tương tự" },
  { category: "Khoa học, công nghệ và đổi mới", subField: "Tương tự" },
  { category: "Cơ chế và chính sách", subField: "Tương tự" },
  { category: "Quản lý phát triển đô thị và nông thôn", subField: "Tương tự" },
  { category: "Tổ chức thực hiện quy hoạch", subField: "Tương tự" },
  { category: "Khác (ghi rõ)", subField: "" },
];

function emptyItem(category: string, subField: string): PY07Item {
  return {
    category,
    subField,
    included: null,
    includedContent: "",
    implementationChecked: null,
    checkResult: null,
    remedy: "",
    selfEvaluation: "",
  };
}

// ---------------------------------------------------------------------------
// Check-result selector
// ---------------------------------------------------------------------------

const CHECK_RESULT_OPTIONS = [
  {
    value: "poor",
    label: "Yếu",
    activeClass: "bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-600",
  },
  {
    value: "fair",
    label: "Trung bình",
    activeClass:
      "bg-yellow-500 text-white hover:bg-yellow-600 hover:text-white border-yellow-500",
  },
  {
    value: "good",
    label: "Tốt",
    activeClass:
      "bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-600",
  },
] as const;

function CheckResultSelector({
  value,
  onChange,
  readOnly,
}: {
  value: string | null;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="inline-flex gap-1">
      {CHECK_RESULT_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <Button
            key={opt.value}
            type="button"
            variant="outline"
            size="xs"
            className={cn(
              "text-xs font-medium transition-colors",
              isActive ? opt.activeClass : "text-muted-foreground"
            )}
            onClick={() => {
              if (!readOnly) onChange(opt.value);
            }}
            disabled={readOnly}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY07ActionProgram({
  value,
  onChange,
  readOnly = false,
}: FormPY07ActionProgramProps) {
  // Normalise incoming data — initialise with 10 predefined items if empty
  const data: PY07Data = useMemo(() => {
    const items = value?.items;
    if (items && items.length > 0) return { items };
    return {
      items: DEFAULT_ITEMS.map((d) => emptyItem(d.category, d.subField)),
    };
  }, [value]);

  const updateItem = useCallback(
    (index: number, patch: Partial<PY07Item>) => {
      const items = data.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      );
      onChange({ items });
    },
    [data, onChange]
  );

  // Determine row category span for visual grouping
  const categorySpans = useMemo(() => {
    const spans: { start: number; count: number; label: string }[] = [];
    let i = 0;
    while (i < data.items.length) {
      const cat = data.items[i].category;
      let count = 1;
      while (
        i + count < data.items.length &&
        data.items[i + count].category === cat
      ) {
        count++;
      }
      spans.push({ start: i, count, label: cat });
      i += count;
    }
    return spans;
  }, [data.items]);

  // Build a lookup: index -> span info (for rowSpan rendering)
  const spanLookup = useMemo(() => {
    const lookup: Record<
      number,
      { isFirst: boolean; span: number; label: string }
    > = {};
    for (const s of categorySpans) {
      for (let j = 0; j < s.count; j++) {
        lookup[s.start + j] = {
          isFirst: j === 0,
          span: s.count,
          label: s.label,
        };
      }
    }
    return lookup;
  }, [categorySpans]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          PY-07. Giải pháp triển khai thực hiện quy hoạch (Điều 55.7)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs h-8 px-1 w-8">#</TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[160px]">
                  Phân loại
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[120px]">
                  Lĩnh vực chi tiết
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[100px] text-center">
                  Bao gồm?
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[180px]">
                  Nội dung chính (nếu Có)
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[100px] text-center">
                  Đã kiểm tra?
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[140px] text-center">
                  Kết quả kiểm tra
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[180px]">
                  Biện pháp (nếu Yếu)
                </TableHead>
                <TableHead className="text-xs h-8 px-1 min-w-[180px]">
                  Tự đánh giá
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, idx) => {
                const info = spanLookup[idx];
                const isCustom = idx === data.items.length - 1; // last item is "Other"

                return (
                  <TableRow key={idx}>
                    <TableCell className="px-1 py-1 text-xs text-center text-muted-foreground">
                      {idx + 1}
                    </TableCell>

                    {/* Category — show rowSpan for first in group */}
                    {info.isFirst ? (
                      <TableCell
                        className="px-1 py-1 text-xs font-medium align-top"
                        rowSpan={info.span}
                      >
                        {isCustom ? (
                          <Input
                            type="text"
                            className="h-7 text-xs"
                            placeholder="Nhập tên phân loại"
                            value={item.category}
                            onChange={(e) =>
                              updateItem(idx, { category: e.target.value })
                            }
                            readOnly={readOnly}
                            disabled={readOnly}
                          />
                        ) : (
                          item.category
                        )}
                      </TableCell>
                    ) : null}

                    {/* Sub-field */}
                    <TableCell className="px-1 py-1 text-xs">
                      {isCustom ? (
                        <Input
                          type="text"
                          className="h-7 text-xs"
                          placeholder="Nhập lĩnh vực"
                          value={item.subField}
                          onChange={(e) =>
                            updateItem(idx, { subField: e.target.value })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {item.subField}
                        </span>
                      )}
                    </TableCell>

                    {/* Included? */}
                    <TableCell className="px-1 py-1 text-center">
                      <YesNoToggle
                        value={item.included}
                        onChange={(v) => updateItem(idx, { included: v })}
                        readOnly={readOnly}
                      />
                    </TableCell>

                    {/* Content if Yes */}
                    <TableCell className="px-1 py-1">
                      {item.included === true ? (
                        <Textarea
                          className="min-h-[40px] text-xs resize-none"
                          placeholder="Nhập nội dung chính"
                          value={item.includedContent}
                          onChange={(e) =>
                            updateItem(idx, {
                              includedContent: e.target.value,
                            })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Implementation Checked? */}
                    <TableCell className="px-1 py-1 text-center">
                      <YesNoToggle
                        value={item.implementationChecked}
                        onChange={(v) =>
                          updateItem(idx, { implementationChecked: v })
                        }
                        readOnly={readOnly}
                      />
                    </TableCell>

                    {/* Check Result */}
                    <TableCell className="px-1 py-1 text-center">
                      {item.implementationChecked === true ? (
                        <CheckResultSelector
                          value={item.checkResult}
                          onChange={(v) =>
                            updateItem(idx, { checkResult: v })
                          }
                          readOnly={readOnly}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Remedy if Poor */}
                    <TableCell className="px-1 py-1">
                      {item.checkResult === "poor" ? (
                        <Textarea
                          className="min-h-[40px] text-xs resize-none"
                          placeholder="Nhập biện pháp khắc phục"
                          value={item.remedy}
                          onChange={(e) =>
                            updateItem(idx, { remedy: e.target.value })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Self Evaluation */}
                    <TableCell className="px-1 py-1">
                      <Textarea
                        className="min-h-[40px] text-xs resize-none"
                        placeholder="Nhập nội dung tự đánh giá"
                        value={item.selfEvaluation}
                        onChange={(e) =>
                          updateItem(idx, { selfEvaluation: e.target.value })
                        }
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
