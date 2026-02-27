"use client";

import { useState } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface PY05Item {
  name: string;
  targetLevel: number | null;
  actualLevel: number | null;
  nonAchievementReason: string;
  selfEvaluation: string;
}

interface PY05Category {
  name: string;
  items: PY05Item[];
}

export interface PY05Data {
  categories: PY05Category[];
}

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: { name: string; suggestedItems: string[] }[] = [
  {
    name: "Tài nguyên",
    suggestedItems: [
      "Hiệu quả sử dụng tài nguyên nước",
      "Tuân thủ hạn mức khai thác khoáng sản",
    ],
  },
  {
    name: "Bảo vệ môi trường",
    suggestedItems: [
      "Tỷ lệ xử lý nước thải sinh hoạt",
      "Tỷ lệ thu gom rác tái chế",
    ],
  },
  {
    name: "Thiên nhiên & Đa dạng sinh học",
    suggestedItems: [
      "Tỷ lệ che phủ rừng",
      "Diện tích khu bảo tồn đa dạng sinh học",
    ],
  },
  {
    name: "Phòng chống thiên tai",
    suggestedItems: [
      "Công trình phòng chống thiên tai",
      "Hệ thống giám sát, cảnh báo",
    ],
  },
  {
    name: "Biến đổi khí hậu",
    suggestedItems: [
      "Lượng phát thải khí nhà kính",
      "Chuyển đổi vật nuôi phù hợp BĐKH",
    ],
  },
];

function createEmptyItem(name: string = ""): PY05Item {
  return {
    name,
    targetLevel: null,
    actualLevel: null,
    nonAchievementReason: "",
    selfEvaluation: "",
  };
}

export function createDefaultPY05Data(): PY05Data {
  return {
    categories: DEFAULT_CATEGORIES.map((cat) => ({
      name: cat.name,
      items: cat.suggestedItems.map((itemName) => createEmptyItem(itemName)),
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumericInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

function computeRate(target: number | null, actual: number | null): number | null {
  if (target === null || actual === null || target === 0) return null;
  return (actual / target) * 100;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FormPY05EnvironmentProps {
  value: PY05Data;
  onChange: (data: PY05Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY05Environment({
  value,
  onChange,
  readOnly = false,
}: FormPY05EnvironmentProps) {
  const data: PY05Data =
    value?.categories?.length === 5 ? value : createDefaultPY05Data();

  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>(
    () => {
      const initial: Record<number, boolean> = {};
      data.categories.forEach((_, i) => {
        initial[i] = true;
      });
      return initial;
    }
  );

  const toggleCategory = (catIdx: number) => {
    setOpenCategories((prev) => ({ ...prev, [catIdx]: !prev[catIdx] }));
  };

  const updateItem = (
    catIdx: number,
    itemIdx: number,
    patch: Partial<PY05Item>
  ) => {
    const updated = data.categories.map((cat, ci) => {
      if (ci !== catIdx) return cat;
      return {
        ...cat,
        items: cat.items.map((item, ii) =>
          ii === itemIdx ? { ...item, ...patch } : item
        ),
      };
    });
    onChange({ ...data, categories: updated });
  };

  const addItem = (catIdx: number) => {
    const updated = data.categories.map((cat, ci) => {
      if (ci !== catIdx) return cat;
      return { ...cat, items: [...cat.items, createEmptyItem()] };
    });
    onChange({ ...data, categories: updated });
  };

  const removeItem = (catIdx: number, itemIdx: number) => {
    const updated = data.categories.map((cat, ci) => {
      if (ci !== catIdx) return cat;
      return { ...cat, items: cat.items.filter((_, ii) => ii !== itemIdx) };
    });
    onChange({ ...data, categories: updated });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Tài nguyên, môi trường, thiên tai và BĐKH
          <Badge variant="outline" className="text-[10px] font-normal">
            Điều 55.5
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.categories.map((cat, catIdx) => {
          const isOpen = openCategories[catIdx] ?? true;

          return (
            <Collapsible
              key={catIdx}
              open={isOpen}
              onOpenChange={() => toggleCategory(catIdx)}
            >
              <div className="rounded-lg border">
                {/* Category header */}
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{cat.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {cat.items.length} mục
                      </Badge>
                    </div>
                  </button>
                </CollapsibleTrigger>

                {/* Category content */}
                <CollapsibleContent>
                  <div className="border-t px-1 pb-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs h-8 px-2 w-8 text-center">
                            #
                          </TableHead>
                          <TableHead className="text-xs h-8 px-2 min-w-[180px]">
                            Chỉ tiêu
                          </TableHead>
                          <TableHead className="text-xs h-8 px-2 min-w-[90px] text-center">
                            Mục tiêu
                          </TableHead>
                          <TableHead className="text-xs h-8 px-2 min-w-[90px] text-center">
                            Thực tế
                          </TableHead>
                          <TableHead className="text-xs h-8 px-2 min-w-[80px] text-center">
                            Đạt (%)
                          </TableHead>
                          <TableHead className="text-xs h-8 px-2 min-w-[160px]">
                            Lý do chưa đạt
                          </TableHead>
                          <TableHead className="text-xs h-8 px-2 min-w-[160px]">
                            Tự đánh giá
                          </TableHead>
                          {!readOnly && (
                            <TableHead className="text-xs h-8 px-2 w-8" />
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.items.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={readOnly ? 7 : 8}
                              className="text-center text-xs text-muted-foreground py-3"
                            >
                              Chưa có mục nào
                            </TableCell>
                          </TableRow>
                        ) : (
                          cat.items.map((item, itemIdx) => {
                            const rate = computeRate(
                              item.targetLevel,
                              item.actualLevel
                            );
                            const isBelowThreshold =
                              rate !== null && rate < 80;

                            return (
                              <TableRow key={itemIdx}>
                                {/* Row number */}
                                <TableCell className="px-2 py-1.5 text-xs text-center text-muted-foreground">
                                  {itemIdx + 1}
                                </TableCell>

                                {/* Item name */}
                                <TableCell className="px-2 py-1.5">
                                  <Input
                                    type="text"
                                    className="h-7 text-xs"
                                    value={item.name}
                                    onChange={(e) =>
                                      updateItem(catIdx, itemIdx, {
                                        name: e.target.value,
                                      })
                                    }
                                    readOnly={readOnly}
                                    disabled={readOnly}
                                    placeholder="Tên chỉ tiêu"
                                  />
                                </TableCell>

                                {/* Target level */}
                                <TableCell className="px-2 py-1.5">
                                  <Input
                                    type="number"
                                    className="h-7 text-xs text-center"
                                    value={item.targetLevel ?? ""}
                                    onChange={(e) =>
                                      updateItem(catIdx, itemIdx, {
                                        targetLevel: parseNumericInput(
                                          e.target.value
                                        ),
                                      })
                                    }
                                    readOnly={readOnly}
                                    disabled={readOnly}
                                    placeholder="-"
                                  />
                                </TableCell>

                                {/* Actual level */}
                                <TableCell className="px-2 py-1.5">
                                  <Input
                                    type="number"
                                    className="h-7 text-xs text-center"
                                    value={item.actualLevel ?? ""}
                                    onChange={(e) =>
                                      updateItem(catIdx, itemIdx, {
                                        actualLevel: parseNumericInput(
                                          e.target.value
                                        ),
                                      })
                                    }
                                    readOnly={readOnly}
                                    disabled={readOnly}
                                    placeholder="-"
                                  />
                                </TableCell>

                                {/* Achievement rate (auto-calculated) */}
                                <TableCell className="px-2 py-1.5">
                                  <div
                                    className={cn(
                                      "flex h-7 items-center justify-center rounded-md border text-xs font-medium",
                                      isBelowThreshold
                                        ? "border-red-300 bg-red-50 text-red-700"
                                        : "border-input bg-muted/50 text-foreground"
                                    )}
                                  >
                                    {rate !== null
                                      ? `${rate.toFixed(1)}%`
                                      : "-"}
                                  </div>
                                </TableCell>

                                {/* Non-achievement reason (visible only when < 80%) */}
                                <TableCell className="px-2 py-1.5">
                                  {isBelowThreshold ? (
                                    <Textarea
                                      className="min-h-[40px] text-xs resize-none border-red-200"
                                      value={item.nonAchievementReason}
                                      onChange={(e) =>
                                        updateItem(catIdx, itemIdx, {
                                          nonAchievementReason: e.target.value,
                                        })
                                      }
                                      readOnly={readOnly}
                                      disabled={readOnly}
                                      placeholder="Nhập lý do chưa đạt 80%"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      -
                                    </span>
                                  )}
                                </TableCell>

                                {/* Self evaluation */}
                                <TableCell className="px-2 py-1.5">
                                  <Textarea
                                    className="min-h-[40px] text-xs resize-none"
                                    value={item.selfEvaluation}
                                    onChange={(e) =>
                                      updateItem(catIdx, itemIdx, {
                                        selfEvaluation: e.target.value,
                                      })
                                    }
                                    readOnly={readOnly}
                                    disabled={readOnly}
                                    placeholder="Nhập tự đánh giá"
                                  />
                                </TableCell>

                                {/* Remove button */}
                                {!readOnly && (
                                  <TableCell className="px-2 py-1.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        removeItem(catIdx, itemIdx)
                                      }
                                    >
                                      <X className="size-3" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>

                    {/* Add item button */}
                    {!readOnly && (
                      <div className="px-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => addItem(catIdx)}
                        >
                          <Plus className="size-3" />
                          Thêm mục
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
