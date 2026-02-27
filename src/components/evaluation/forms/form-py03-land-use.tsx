"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface LandTypeRow {
  type: string;
  enabled: boolean;
  plannedArea: number | null;
  usedArea: number | null;
  conversionType: string;
  conversionArea: number | null;
  conversionReason: string;
  selfEvaluation: string;
}

export interface PY03Data {
  landTypes: LandTypeRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAND_TYPE_LABELS: { type: string; label: string }[] = [
  { type: "agricultural", label: "Đất nông nghiệp" },
  { type: "non_agricultural", label: "Đất phi nông nghiệp" },
  { type: "unused", label: "Đất chưa sử dụng" },
  { type: "special_economic", label: "Đất khu kinh tế đặc biệt" },
  { type: "hitech", label: "Đất khu công nghệ cao" },
  { type: "urban", label: "Đất đô thị" },
];

function createDefaultRow(type: string): LandTypeRow {
  return {
    type,
    enabled: false,
    plannedArea: null,
    usedArea: null,
    conversionType: "",
    conversionArea: null,
    conversionReason: "",
    selfEvaluation: "",
  };
}

export function createDefaultPY03Data(): PY03Data {
  return {
    landTypes: LAND_TYPE_LABELS.map((lt) => createDefaultRow(lt.type)),
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

function computeDifference(planned: number | null, used: number | null): number | null {
  if (planned === null || used === null) return null;
  return planned - used;
}

function getLandTypeLabel(type: string): string {
  return LAND_TYPE_LABELS.find((lt) => lt.type === type)?.label ?? type;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FormPY03LandUseProps {
  value: PY03Data;
  onChange: (data: PY03Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY03LandUse({
  value,
  onChange,
  readOnly = false,
}: FormPY03LandUseProps) {
  const data: PY03Data =
    value?.landTypes?.length === 6 ? value : createDefaultPY03Data();

  const updateRow = (index: number, patch: Partial<LandTypeRow>) => {
    const updated = data.landTypes.map((row, i) =>
      i === index ? { ...row, ...patch } : row
    );
    onChange({ ...data, landTypes: updated });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Tình hình sử dụng đất
          <Badge variant="outline" className="text-[10px] font-normal">
            Điều 55.3
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs h-8 px-2 w-10 text-center">#</TableHead>
                <TableHead className="text-xs h-8 px-2 w-10 text-center">
                  Áp dụng
                </TableHead>
                <TableHead className="text-xs h-8 px-2 min-w-[140px]">
                  Loại đất
                </TableHead>
                <TableHead className="text-xs h-8 px-2 min-w-[100px] text-center">
                  Diện tích QH (ha)
                </TableHead>
                <TableHead className="text-xs h-8 px-2 min-w-[100px] text-center">
                  Diện tích SD (ha)
                </TableHead>
                <TableHead className="text-xs h-8 px-2 min-w-[100px] text-center">
                  Chênh lệch (ha)
                </TableHead>
                <TableHead className="text-xs h-8 px-2 min-w-[260px]">
                  Chuyển đổi mục đích
                </TableHead>
                <TableHead className="text-xs h-8 px-2 min-w-[180px]">
                  Tự đánh giá
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.landTypes.map((row, idx) => {
                const diff = computeDifference(row.plannedArea, row.usedArea);
                const isDiffNegative = diff !== null && diff < 0;

                return (
                  <TableRow
                    key={row.type}
                    className={cn(!row.enabled && "opacity-50")}
                  >
                    {/* Row number */}
                    <TableCell className="px-2 py-1.5 text-xs text-center text-muted-foreground">
                      {idx + 1}
                    </TableCell>

                    {/* Enable checkbox */}
                    <TableCell className="px-2 py-1.5 text-center">
                      <Checkbox
                        checked={row.enabled}
                        onCheckedChange={(checked) =>
                          updateRow(idx, { enabled: !!checked })
                        }
                        disabled={readOnly}
                      />
                    </TableCell>

                    {/* Land type label */}
                    <TableCell className="px-2 py-1.5">
                      <span className="text-xs font-medium">
                        {getLandTypeLabel(row.type)}
                      </span>
                    </TableCell>

                    {/* Planned area */}
                    <TableCell className="px-2 py-1.5">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center"
                        value={row.plannedArea ?? ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            plannedArea: parseNumericInput(e.target.value),
                          })
                        }
                        readOnly={readOnly}
                        disabled={readOnly || !row.enabled}
                        placeholder="-"
                      />
                    </TableCell>

                    {/* Used area */}
                    <TableCell className="px-2 py-1.5">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center"
                        value={row.usedArea ?? ""}
                        onChange={(e) =>
                          updateRow(idx, {
                            usedArea: parseNumericInput(e.target.value),
                          })
                        }
                        readOnly={readOnly}
                        disabled={readOnly || !row.enabled}
                        placeholder="-"
                      />
                    </TableCell>

                    {/* Difference (auto-calculated) */}
                    <TableCell className="px-2 py-1.5">
                      <div
                        className={cn(
                          "flex h-7 items-center justify-center rounded-md border text-xs font-medium",
                          !row.enabled
                            ? "border-input bg-muted/30 text-muted-foreground"
                            : isDiffNegative
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-input bg-muted/50 text-foreground"
                        )}
                      >
                        {row.enabled && diff !== null
                          ? diff.toLocaleString("vi-VN", {
                              maximumFractionDigits: 2,
                            })
                          : "-"}
                      </div>
                    </TableCell>

                    {/* Conversion status */}
                    <TableCell className="px-2 py-1.5">
                      <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-2 gap-1">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground leading-none">
                              Loại chuyển đổi
                            </span>
                            <Input
                              type="text"
                              className="h-7 text-xs"
                              value={row.conversionType}
                              onChange={(e) =>
                                updateRow(idx, {
                                  conversionType: e.target.value,
                                })
                              }
                              readOnly={readOnly}
                              disabled={readOnly || !row.enabled}
                              placeholder="-"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground leading-none">
                              DT chuyển đổi (ha)
                            </span>
                            <Input
                              type="number"
                              className="h-7 text-xs text-center"
                              value={row.conversionArea ?? ""}
                              onChange={(e) =>
                                updateRow(idx, {
                                  conversionArea: parseNumericInput(
                                    e.target.value
                                  ),
                                })
                              }
                              readOnly={readOnly}
                              disabled={readOnly || !row.enabled}
                              placeholder="-"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground leading-none">
                            Lý do chuyển đổi
                          </span>
                          <Input
                            type="text"
                            className="h-7 text-xs"
                            value={row.conversionReason}
                            onChange={(e) =>
                              updateRow(idx, {
                                conversionReason: e.target.value,
                              })
                            }
                            readOnly={readOnly}
                            disabled={readOnly || !row.enabled}
                            placeholder="-"
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Self evaluation */}
                    <TableCell className="px-2 py-1.5">
                      <Textarea
                        className="min-h-[56px] text-xs resize-none"
                        value={row.selfEvaluation}
                        onChange={(e) =>
                          updateRow(idx, { selfEvaluation: e.target.value })
                        }
                        readOnly={readOnly}
                        disabled={readOnly || !row.enabled}
                        placeholder="Nhập tự đánh giá"
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
