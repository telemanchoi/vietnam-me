"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { StatusSelector } from "./shared/status-selector";
import { PrioritySelector } from "./shared/priority-selector";
import { YesNoToggle } from "./shared/yes-no-toggle";
import { SelfEvaluationCell } from "./shared/self-evaluation-cell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PY02Project {
  name: string;
  area: number | null;
  budget: number | null;
  priority: string | null; // "high" | "medium" | "low"
  status: string; // "preparation" | "in_progress" | "completed" | "suspended"
  statusReason: string;
  statusStage: string;
}

interface PY02Category {
  type: string; // "urban" | "rural" | "functional"
  enabled: boolean;
  projects: PY02Project[];
}

interface PY02Step2Entry {
  categoryType: string;
  projectName: string;
  projectStatus: string;
  locationCompliance: boolean | null;
  usageCompliance: boolean | null;
  overallCompliance: string | null; // "appropriate" | "inappropriate"
  target: number | null;
  actual: number | null;
  selfEvaluation: string;
  improvementNeeds: string;
}

interface PY02Data {
  categories: PY02Category[];
  step2: {
    entries: PY02Step2Entry[];
  };
}

interface FormPY02UrbanRuralProps {
  value: PY02Data;
  onChange: (data: PY02Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  urban: { label: "Đô thị", color: "bg-blue-100 text-blue-800" },
  rural: { label: "Nông thôn", color: "bg-green-100 text-green-800" },
  functional: { label: "Khu chức năng", color: "bg-purple-100 text-purple-800" },
};

const DEFAULT_CATEGORIES: PY02Category[] = [
  { type: "urban", enabled: false, projects: [] },
  { type: "rural", enabled: false, projects: [] },
  { type: "functional", enabled: false, projects: [] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyProject(): PY02Project {
  return {
    name: "",
    area: null,
    budget: null,
    priority: null,
    status: "preparation",
    statusReason: "",
    statusStage: "",
  };
}

function ensureCategories(data: PY02Data): PY02Category[] {
  if (data.categories && data.categories.length === 3) return data.categories;
  // Merge existing data with defaults
  return DEFAULT_CATEGORIES.map((def) => {
    const existing = data.categories?.find((c) => c.type === def.type);
    return existing ?? { ...def };
  });
}

function buildStep2Entries(
  categories: PY02Category[],
  existingEntries: PY02Step2Entry[]
): PY02Step2Entry[] {
  const entries: PY02Step2Entry[] = [];
  for (const cat of categories) {
    if (!cat.enabled) continue;
    for (const proj of cat.projects) {
      if (!proj.name.trim()) continue;
      // Preserve existing step2 data if present
      const existing = existingEntries.find(
        (e) => e.categoryType === cat.type && e.projectName === proj.name
      );
      entries.push({
        categoryType: cat.type,
        projectName: proj.name,
        projectStatus: proj.status,
        locationCompliance: existing?.locationCompliance ?? null,
        usageCompliance: existing?.usageCompliance ?? null,
        overallCompliance: existing?.overallCompliance ?? null,
        target: existing?.target ?? null,
        actual: existing?.actual ?? null,
        selfEvaluation: existing?.selfEvaluation ?? "",
        improvementNeeds: existing?.improvementNeeds ?? "",
      });
    }
  }
  return entries;
}

function parseNumericInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

function computeRate(target: number | null, actual: number | null): number | null {
  if (target !== null && actual !== null && target !== 0) {
    return (actual / target) * 100;
  }
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  preparation: "Chuẩn bị triển khai",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  suspended: "Tạm dừng",
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function FormPY02UrbanRural({
  value,
  onChange,
  readOnly = false,
}: FormPY02UrbanRuralProps) {
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Normalize data
  const categories = useMemo(() => ensureCategories(value), [value]);
  const step2Entries = useMemo(
    () => value.step2?.entries ?? [],
    [value]
  );

  // ---- Data mutation helpers ----

  const updateCategories = useCallback(
    (newCategories: PY02Category[]) => {
      // Auto-rebuild step2 entries when step1 changes
      const newStep2Entries = buildStep2Entries(
        newCategories,
        step2Entries
      );
      onChange({
        ...value,
        categories: newCategories,
        step2: { entries: newStep2Entries },
      });
    },
    [onChange, value, step2Entries]
  );

  const updateStep2Entry = useCallback(
    (index: number, partial: Partial<PY02Step2Entry>) => {
      const updated = step2Entries.map((entry, i) =>
        i === index ? { ...entry, ...partial } : entry
      );
      onChange({
        ...value,
        step2: { entries: updated },
      });
    },
    [onChange, value, step2Entries]
  );

  // ---- Category toggles ----

  const toggleCategory = useCallback(
    (catType: string, enabled: boolean) => {
      const updated = categories.map((c) =>
        c.type === catType ? { ...c, enabled } : c
      );
      updateCategories(updated);
    },
    [categories, updateCategories]
  );

  // ---- Project CRUD ----

  const addProject = useCallback(
    (catType: string) => {
      const updated = categories.map((c) =>
        c.type === catType
          ? { ...c, projects: [...c.projects, createEmptyProject()] }
          : c
      );
      updateCategories(updated);
    },
    [categories, updateCategories]
  );

  const removeProject = useCallback(
    (catType: string, projectIndex: number) => {
      const updated = categories.map((c) =>
        c.type === catType
          ? { ...c, projects: c.projects.filter((_, i) => i !== projectIndex) }
          : c
      );
      updateCategories(updated);
    },
    [categories, updateCategories]
  );

  const updateProject = useCallback(
    (catType: string, projectIndex: number, partial: Partial<PY02Project>) => {
      const updated = categories.map((c) =>
        c.type === catType
          ? {
              ...c,
              projects: c.projects.map((p, i) =>
                i === projectIndex ? { ...p, ...partial } : p
              ),
            }
          : c
      );
      updateCategories(updated);
    },
    [categories, updateCategories]
  );

  // ---- Computed step2 entries grouped by category ----

  const step2ByCategory = useMemo(() => {
    const freshEntries = buildStep2Entries(categories, step2Entries);
    const grouped: Record<string, { entries: { entry: PY02Step2Entry; globalIndex: number }[] }> = {};
    freshEntries.forEach((entry, idx) => {
      if (!grouped[entry.categoryType]) {
        grouped[entry.categoryType] = { entries: [] };
      }
      grouped[entry.categoryType].entries.push({ entry, globalIndex: idx });
    });
    return grouped;
  }, [categories, step2Entries]);

  // Fresh step2 entries for rendering
  const freshStep2Entries = useMemo(
    () => buildStep2Entries(categories, step2Entries),
    [categories, step2Entries]
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <Card className="gap-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">
          PY-02: Hệ thống đô thị, nông thôn và khu chức năng
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Đánh giá thực hiện phát triển hệ thống đô thị, nông thôn và khu chức năng (Điều 55.2)
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Step navigation */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={activeStep === 1 ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setActiveStep(1)}
          >
            Bước 1: Bảng hiện trạng
          </Button>
          <Button
            type="button"
            variant={activeStep === 2 ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setActiveStep(2)}
          >
            Bước 2: Đánh giá thực hiện
          </Button>
        </div>

        {activeStep === 1 && (
          <Step1StatusTable
            categories={categories}
            onToggleCategory={toggleCategory}
            onAddProject={addProject}
            onRemoveProject={removeProject}
            onUpdateProject={updateProject}
            readOnly={readOnly}
          />
        )}

        {activeStep === 2 && (
          <Step2EvaluationTable
            categories={categories}
            entries={freshStep2Entries}
            onUpdateEntry={updateStep2Entry}
            readOnly={readOnly}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Step 1 - Status Table
// ===========================================================================

interface Step1Props {
  categories: PY02Category[];
  onToggleCategory: (catType: string, enabled: boolean) => void;
  onAddProject: (catType: string) => void;
  onRemoveProject: (catType: string, projectIndex: number) => void;
  onUpdateProject: (catType: string, projectIndex: number, partial: Partial<PY02Project>) => void;
  readOnly: boolean;
}

function Step1StatusTable({
  categories,
  onToggleCategory,
  onAddProject,
  onRemoveProject,
  onUpdateProject,
  readOnly,
}: Step1Props) {
  return (
    <div className="flex flex-col gap-6">
      {categories.map((cat) => {
        const meta = CATEGORY_META[cat.type];
        return (
          <div key={cat.type} className="flex flex-col gap-3">
            {/* Category header with toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={cat.enabled}
                onCheckedChange={(checked) =>
                  onToggleCategory(cat.type, checked === true)
                }
                disabled={readOnly}
              />
              <Badge variant="outline" className={cn("text-xs", meta.color)}>
                {meta.label}
              </Badge>
              {!cat.enabled && (
                <span className="text-xs text-muted-foreground">
                  Chưa kích hoạt
                </span>
              )}
            </div>

            {/* Projects table (shown only when enabled) */}
            {cat.enabled && (
              <div className="ml-6 flex flex-col gap-2">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-8 px-2 min-w-[40px] w-[40px]">
                          STT
                        </TableHead>
                        <TableHead className="text-xs h-8 px-2 min-w-[180px]">
                          Tên dự án / hạng mục
                        </TableHead>
                        <TableHead className="text-xs h-8 px-2 min-w-[100px] w-[100px]">
                          Diện tích (ha)
                        </TableHead>
                        <TableHead className="text-xs h-8 px-2 min-w-[120px] w-[120px]">
                          Vốn đầu tư (tỷ đồng)
                        </TableHead>
                        <TableHead className="text-xs h-8 px-2 min-w-[160px] w-[160px]">
                          Ưu tiên đầu tư
                        </TableHead>
                        <TableHead className="text-xs h-8 px-2 min-w-[180px] w-[180px]">
                          Trạng thái thực hiện
                        </TableHead>
                        {!readOnly && (
                          <TableHead className="text-xs h-8 px-2 w-[40px]" />
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cat.projects.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={readOnly ? 6 : 7}
                            className="text-center text-xs text-muted-foreground py-4"
                          >
                            Chưa có dự án. Nhấn &quot;Thêm dòng&quot; để bắt đầu.
                          </TableCell>
                        </TableRow>
                      ) : (
                        cat.projects.map((proj, pIdx) => (
                          <TableRow key={pIdx}>
                            {/* STT */}
                            <TableCell className="text-xs text-center px-2 py-1.5">
                              {pIdx + 1}
                            </TableCell>

                            {/* Project name */}
                            <TableCell className="px-2 py-1.5">
                              <Input
                                type="text"
                                className="h-7 text-xs"
                                placeholder="Nhập tên dự án"
                                value={proj.name}
                                onChange={(e) =>
                                  onUpdateProject(cat.type, pIdx, {
                                    name: e.target.value,
                                  })
                                }
                                readOnly={readOnly}
                                disabled={readOnly}
                              />
                            </TableCell>

                            {/* Area */}
                            <TableCell className="px-2 py-1.5">
                              <Input
                                type="number"
                                className="h-7 text-xs text-right"
                                placeholder="0"
                                value={proj.area ?? ""}
                                onChange={(e) =>
                                  onUpdateProject(cat.type, pIdx, {
                                    area: parseNumericInput(e.target.value),
                                  })
                                }
                                readOnly={readOnly}
                                disabled={readOnly}
                              />
                            </TableCell>

                            {/* Budget */}
                            <TableCell className="px-2 py-1.5">
                              <Input
                                type="number"
                                className="h-7 text-xs text-right"
                                placeholder="0"
                                value={proj.budget ?? ""}
                                onChange={(e) =>
                                  onUpdateProject(cat.type, pIdx, {
                                    budget: parseNumericInput(e.target.value),
                                  })
                                }
                                readOnly={readOnly}
                                disabled={readOnly}
                              />
                            </TableCell>

                            {/* Priority */}
                            <TableCell className="px-2 py-1.5">
                              <PrioritySelector
                                value={proj.priority}
                                onChange={(v) =>
                                  onUpdateProject(cat.type, pIdx, {
                                    priority: v,
                                  })
                                }
                                readOnly={readOnly}
                              />
                            </TableCell>

                            {/* Status */}
                            <TableCell className="px-2 py-1.5">
                              <StatusSelector
                                value={proj.status}
                                reason={proj.statusReason}
                                stage={proj.statusStage}
                                onChange={(status, reason, stage) =>
                                  onUpdateProject(cat.type, pIdx, {
                                    status,
                                    statusReason: reason ?? "",
                                    statusStage: stage ?? "",
                                  })
                                }
                                readOnly={readOnly}
                              />
                            </TableCell>

                            {/* Delete */}
                            {!readOnly && (
                              <TableCell className="px-2 py-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    onRemoveProject(cat.type, pIdx)
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Add row button */}
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="self-start text-xs gap-1"
                    onClick={() => onAddProject(cat.type)}
                  >
                    <Plus className="size-3" />
                    Thêm dòng
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Step 2 - Implementation Evaluation Table
// ===========================================================================

interface Step2Props {
  categories: PY02Category[];
  entries: PY02Step2Entry[];
  onUpdateEntry: (index: number, partial: Partial<PY02Step2Entry>) => void;
  readOnly: boolean;
}

function Step2EvaluationTable({
  categories,
  entries,
  onUpdateEntry,
  readOnly,
}: Step2Props) {
  // Group entries by category for subtotal rows
  const enabledCategories = categories.filter((c) => c.enabled);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-2">
        <p>Chưa có dữ liệu đánh giá.</p>
        <p className="text-xs">
          Vui lòng quay lại Bước 1 để nhập thông tin dự án trước.
        </p>
      </div>
    );
  }

  // Build grouped structure for rendering
  type GroupedCategory = {
    type: string;
    label: string;
    color: string;
    rows: { entry: PY02Step2Entry; globalIndex: number }[];
  };

  const grouped: GroupedCategory[] = [];
  let globalIdx = 0;
  for (const cat of enabledCategories) {
    const meta = CATEGORY_META[cat.type];
    const catRows: { entry: PY02Step2Entry; globalIndex: number }[] = [];
    for (const proj of cat.projects) {
      if (!proj.name.trim()) continue;
      const matchingEntry = entries[globalIdx];
      if (matchingEntry) {
        catRows.push({ entry: matchingEntry, globalIndex: globalIdx });
      }
      globalIdx++;
    }
    if (catRows.length > 0) {
      grouped.push({
        type: cat.type,
        label: meta.label,
        color: meta.color,
        rows: catRows,
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs h-8 px-2 min-w-[40px] w-[40px]" rowSpan={2}>
              STT
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[140px]" rowSpan={2}>
              Phân loại
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[160px]" rowSpan={2}>
              Tên dự án
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[100px]" rowSpan={2}>
              Trạng thái
            </TableHead>
            <TableHead className="text-xs h-8 px-2 text-center" colSpan={3}>
              Tính phù hợp không gian
            </TableHead>
            <TableHead className="text-xs h-8 px-2 text-center" colSpan={3}>
              Tiến độ thực hiện
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[200px]" rowSpan={2}>
              Tự đánh giá
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="text-xs h-8 px-2 min-w-[100px]">
              Vị trí
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[100px]">
              Mục đích SD
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[110px]">
              Tổng hợp
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[80px] text-right">
              Mục tiêu
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[80px] text-right">
              Thực tế
            </TableHead>
            <TableHead className="text-xs h-8 px-2 min-w-[80px] text-right">
              Đạt (%)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((group) => {
            // Compute category average achievement rate
            const ratesInGroup = group.rows
              .filter((r) => r.entry.projectStatus !== "suspended")
              .map((r) => computeRate(r.entry.target, r.entry.actual))
              .filter((r): r is number => r !== null);
            const avgRate =
              ratesInGroup.length > 0
                ? ratesInGroup.reduce((a, b) => a + b, 0) / ratesInGroup.length
                : null;

            let rowCounter = 0;

            return [
              // Data rows
              ...group.rows.map((row) => {
                rowCounter++;
                const isSuspended = row.entry.projectStatus === "suspended";
                const rate = computeRate(row.entry.target, row.entry.actual);
                const isBelowThreshold = rate !== null && rate < 80;

                return (
                  <TableRow
                    key={`${group.type}-${row.globalIndex}`}
                    className={cn(isSuspended && "opacity-50 bg-muted/30")}
                  >
                    {/* STT */}
                    <TableCell className="text-xs text-center px-2 py-1.5">
                      {rowCounter}
                    </TableCell>

                    {/* Category */}
                    <TableCell className="px-2 py-1.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", group.color)}
                      >
                        {group.label}
                      </Badge>
                    </TableCell>

                    {/* Project name */}
                    <TableCell className="text-xs px-2 py-1.5 font-medium">
                      {row.entry.projectName}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-2 py-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          row.entry.projectStatus === "completed" &&
                            "bg-green-50 text-green-700 border-green-200",
                          row.entry.projectStatus === "in_progress" &&
                            "bg-blue-50 text-blue-700 border-blue-200",
                          row.entry.projectStatus === "preparation" &&
                            "bg-yellow-50 text-yellow-700 border-yellow-200",
                          row.entry.projectStatus === "suspended" &&
                            "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {STATUS_LABELS[row.entry.projectStatus] ??
                          row.entry.projectStatus}
                      </Badge>
                    </TableCell>

                    {isSuspended ? (
                      /* Suspended: show grayed-out merged cell */
                      <TableCell
                        colSpan={7}
                        className="text-xs text-center text-muted-foreground italic px-2 py-3"
                      >
                        Dự án tạm dừng - không đánh giá
                      </TableCell>
                    ) : (
                      <>
                        {/* Location compliance */}
                        <TableCell className="px-2 py-1.5">
                          <YesNoToggle
                            value={row.entry.locationCompliance}
                            onChange={(v) =>
                              onUpdateEntry(row.globalIndex, {
                                locationCompliance: v,
                              })
                            }
                            readOnly={readOnly}
                          />
                        </TableCell>

                        {/* Usage compliance */}
                        <TableCell className="px-2 py-1.5">
                          <YesNoToggle
                            value={row.entry.usageCompliance}
                            onChange={(v) =>
                              onUpdateEntry(row.globalIndex, {
                                usageCompliance: v,
                              })
                            }
                            readOnly={readOnly}
                          />
                        </TableCell>

                        {/* Overall compliance */}
                        <TableCell className="px-2 py-1.5">
                          <PrioritySelector
                            value={row.entry.overallCompliance}
                            onChange={(v) =>
                              onUpdateEntry(row.globalIndex, {
                                overallCompliance: v,
                              })
                            }
                            mode="compliance"
                            readOnly={readOnly}
                          />
                        </TableCell>

                        {/* Target */}
                        <TableCell className="px-2 py-1.5">
                          <Input
                            type="number"
                            className="h-7 text-xs text-right w-[70px]"
                            placeholder="-"
                            value={row.entry.target ?? ""}
                            onChange={(e) =>
                              onUpdateEntry(row.globalIndex, {
                                target: parseNumericInput(e.target.value),
                              })
                            }
                            readOnly={readOnly}
                            disabled={readOnly}
                          />
                        </TableCell>

                        {/* Actual */}
                        <TableCell className="px-2 py-1.5">
                          <Input
                            type="number"
                            className="h-7 text-xs text-right w-[70px]"
                            placeholder="-"
                            value={row.entry.actual ?? ""}
                            onChange={(e) =>
                              onUpdateEntry(row.globalIndex, {
                                actual: parseNumericInput(e.target.value),
                              })
                            }
                            readOnly={readOnly}
                            disabled={readOnly}
                          />
                        </TableCell>

                        {/* Achievement rate */}
                        <TableCell className="px-2 py-1.5">
                          <div
                            className={cn(
                              "flex h-7 items-center justify-center rounded-md border text-xs font-medium w-[70px]",
                              isBelowThreshold
                                ? "border-red-300 bg-red-50 text-red-700"
                                : "border-input bg-muted/50 text-foreground"
                            )}
                          >
                            {rate !== null ? `${rate.toFixed(1)}%` : "-"}
                          </div>
                        </TableCell>

                        {/* Self evaluation */}
                        <TableCell className="px-2 py-1.5">
                          <SelfEvaluationCell
                            evaluation={row.entry.selfEvaluation}
                            improvementNeeds={row.entry.improvementNeeds}
                            onEvaluationChange={(v) =>
                              onUpdateEntry(row.globalIndex, {
                                selfEvaluation: v,
                              })
                            }
                            onImprovementChange={(v) =>
                              onUpdateEntry(row.globalIndex, {
                                improvementNeeds: v,
                              })
                            }
                            readOnly={readOnly}
                          />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              }),

              // Category subtotal row
              <TableRow
                key={`${group.type}-subtotal`}
                className="bg-muted/40 font-medium"
              >
                <TableCell colSpan={9} className="text-xs px-2 py-2 text-right">
                  <span className="mr-2">
                    Trung bình {group.label}:
                  </span>
                </TableCell>
                <TableCell className="text-xs px-2 py-2 text-right" colSpan={1}>
                  <div
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold",
                      avgRate !== null && avgRate < 80
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-input bg-background text-foreground"
                    )}
                  >
                    {avgRate !== null ? `${avgRate.toFixed(1)}%` : "-"}
                  </div>
                </TableCell>
                <TableCell className="px-2 py-2" />
              </TableRow>,
            ];
          })}
        </TableBody>
      </Table>
    </div>
  );
}
