"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { PrioritySelector } from "./shared/priority-selector";
import { StatusSelector } from "./shared/status-selector";
import { YesNoToggle } from "./shared/yes-no-toggle";
import { SelfEvaluationCell } from "./shared/self-evaluation-cell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectRow {
  name: string;
  budgetSize: number | null;
  priority: string | null;
  status: string;
  statusReason: string;
  statusStage: string;
}

interface Step2Entry {
  projectName: string;
  projectStatus: string;
  budgetTarget: number | null;
  budgetActual: number | null;
  budgetSecured: boolean | null;
  budgetRatio: string | null;
  progressTarget: number | null;
  progressActual: number | null;
  selfEvaluation: string;
  improvementNeeds: string;
}

interface PY04Data {
  step1: {
    projects: ProjectRow[];
  };
  step2: {
    entries: Step2Entry[];
  };
}

interface FormPY04ProjectsProps {
  value: Partial<PY04Data>;
  onChange: (data: PY04Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyProject(): ProjectRow {
  return {
    name: "",
    budgetSize: null,
    priority: null,
    status: "",
    statusReason: "",
    statusStage: "",
  };
}

function emptyStep2Entry(name: string, status: string): Step2Entry {
  return {
    projectName: name,
    projectStatus: status,
    budgetTarget: null,
    budgetActual: null,
    budgetSecured: null,
    budgetRatio: null,
    progressTarget: null,
    progressActual: null,
    selfEvaluation: "",
    improvementNeeds: "",
  };
}

function parseNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function calcRate(target: number | null, actual: number | null): number | null {
  if (target !== null && actual !== null && target !== 0) {
    return (actual / target) * 100;
  }
  return null;
}

const STATUS_LABEL: Record<string, string> = {
  preparation: "Chuẩn bị triển khai",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  suspended: "Tạm dừng",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY04Projects({
  value,
  onChange,
  readOnly = false,
}: FormPY04ProjectsProps) {
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Normalise incoming data
  const data: PY04Data = useMemo(() => ({
    step1: {
      projects: value?.step1?.projects ?? [emptyProject()],
    },
    step2: {
      entries: value?.step2?.entries ?? [],
    },
  }), [value]);

  // --- Step 1 mutations ---

  const updateProject = useCallback(
    (index: number, patch: Partial<ProjectRow>) => {
      const projects = data.step1.projects.map((p, i) =>
        i === index ? { ...p, ...patch } : p
      );
      onChange({ ...data, step1: { projects } });
    },
    [data, onChange]
  );

  const addProject = useCallback(() => {
    onChange({
      ...data,
      step1: { projects: [...data.step1.projects, emptyProject()] },
    });
  }, [data, onChange]);

  const removeProject = useCallback(
    (index: number) => {
      onChange({
        ...data,
        step1: {
          projects: data.step1.projects.filter((_, i) => i !== index),
        },
      });
    },
    [data, onChange]
  );

  // --- Step 2 sync & mutations ---

  const syncAndGoStep2 = useCallback(() => {
    // Auto-generate step2 entries from step1 projects, preserving existing data
    const existingMap = new Map(
      data.step2.entries.map((e) => [e.projectName, e])
    );
    const entries = data.step1.projects.map((p) => {
      const existing = existingMap.get(p.name);
      if (existing) {
        return { ...existing, projectStatus: p.status };
      }
      return emptyStep2Entry(p.name, p.status);
    });
    onChange({ ...data, step2: { entries } });
    setActiveStep(2);
  }, [data, onChange]);

  const updateEntry = useCallback(
    (index: number, patch: Partial<Step2Entry>) => {
      const entries = data.step2.entries.map((e, i) =>
        i === index ? { ...e, ...patch } : e
      );
      onChange({ ...data, step2: { entries } });
    },
    [data, onChange]
  );

  // --- Summary calculations ---
  const step2Summary = useMemo(() => {
    const activeEntries = data.step2.entries.filter(
      (e) => e.projectStatus !== "suspended"
    );
    if (activeEntries.length === 0) return { avgBudgetRate: null, avgProgressRate: null };

    const budgetRates = activeEntries
      .map((e) => calcRate(e.budgetTarget, e.budgetActual))
      .filter((r): r is number => r !== null);
    const progressRates = activeEntries
      .map((e) => calcRate(e.progressTarget, e.progressActual))
      .filter((r): r is number => r !== null);

    return {
      avgBudgetRate:
        budgetRates.length > 0
          ? budgetRates.reduce((a, b) => a + b, 0) / budgetRates.length
          : null,
      avgProgressRate:
        progressRates.length > 0
          ? progressRates.reduce((a, b) => a + b, 0) / progressRates.length
          : null,
    };
  }, [data.step2.entries]);

  // ---------------------------------------------------------------------------
  // Tab bar
  // ---------------------------------------------------------------------------

  const tabBar = (
    <div className="flex gap-1 mb-4">
      <Button
        type="button"
        variant={activeStep === 1 ? "default" : "outline"}
        size="sm"
        className="text-xs"
        onClick={() => setActiveStep(1)}
      >
        1단계: Bảng hiện trạng
      </Button>
      <Button
        type="button"
        variant={activeStep === 2 ? "default" : "outline"}
        size="sm"
        className="text-xs"
        onClick={syncAndGoStep2}
      >
        2단계: Đánh giá thực hiện
      </Button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 1 - Project Status Table
  // ---------------------------------------------------------------------------

  const step1Content = (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs h-8 px-1 w-8">#</TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[180px]">
              Tên dự án
            </TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[120px]">
              Quy mô vốn
            </TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[160px]">
              Ưu tiên đầu tư
            </TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[200px]">
              Trạng thái thực hiện
            </TableHead>
            {!readOnly && <TableHead className="text-xs h-8 px-1 w-8" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.step1.projects.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={readOnly ? 5 : 6}
                className="text-center text-xs text-muted-foreground py-4"
              >
                Chưa có dữ liệu
              </TableCell>
            </TableRow>
          ) : (
            data.step1.projects.map((project, idx) => (
              <TableRow key={idx}>
                <TableCell className="px-1 py-1 text-xs text-center text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell className="px-1 py-1">
                  <Input
                    type="text"
                    className="h-7 text-xs"
                    placeholder="Nhập tên dự án"
                    value={project.name}
                    onChange={(e) =>
                      updateProject(idx, { name: e.target.value })
                    }
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell className="px-1 py-1">
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    placeholder="Tỷ VND"
                    value={project.budgetSize ?? ""}
                    onChange={(e) =>
                      updateProject(idx, {
                        budgetSize: parseNum(e.target.value),
                      })
                    }
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell className="px-1 py-1">
                  <PrioritySelector
                    value={project.priority}
                    onChange={(v) => updateProject(idx, { priority: v })}
                    readOnly={readOnly}
                  />
                </TableCell>
                <TableCell className="px-1 py-1">
                  <StatusSelector
                    value={project.status}
                    reason={project.statusReason}
                    stage={project.statusStage}
                    onChange={(s, r, st) =>
                      updateProject(idx, {
                        status: s,
                        statusReason: r ?? project.statusReason,
                        statusStage: st ?? project.statusStage,
                      })
                    }
                    readOnly={readOnly}
                  />
                </TableCell>
                {!readOnly && (
                  <TableCell className="px-1 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeProject(idx)}
                    >
                      <X className="size-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="mt-2 text-xs gap-1"
          onClick={addProject}
        >
          <Plus className="size-3" />
          Thêm dự án
        </Button>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 2 - Implementation Evaluation
  // ---------------------------------------------------------------------------

  const step2Content = (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs h-8 px-1 w-8">#</TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[140px]">
              Tên dự án
            </TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[100px]">
              Trạng thái
            </TableHead>
            <TableHead
              className="text-xs h-8 px-1 text-center min-w-[320px]"
              colSpan={4}
            >
              Tỷ lệ huy động vốn đầu tư
            </TableHead>
            <TableHead
              className="text-xs h-8 px-1 text-center min-w-[240px]"
              colSpan={3}
            >
              Tiến độ thực hiện
            </TableHead>
            <TableHead className="text-xs h-8 px-1 min-w-[220px]">
              Tự đánh giá / Cần cải thiện
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="text-[10px] h-6 px-1" />
            <TableHead className="text-[10px] h-6 px-1" />
            <TableHead className="text-[10px] h-6 px-1" />
            {/* Budget sub-headers */}
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Mục tiêu
            </TableHead>
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Thực tế
            </TableHead>
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Đã huy động?
            </TableHead>
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Tỷ lệ
            </TableHead>
            {/* Progress sub-headers */}
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Mục tiêu
            </TableHead>
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Thực tế
            </TableHead>
            <TableHead className="text-[10px] h-6 px-1 text-center min-w-[80px]">
              Đạt (%)
            </TableHead>
            <TableHead className="text-[10px] h-6 px-1" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.step2.entries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="text-center text-xs text-muted-foreground py-4"
              >
                Chuyển sang bước 2 để tự động tạo danh sách từ bước 1
              </TableCell>
            </TableRow>
          ) : (
            <>
              {data.step2.entries.map((entry, idx) => {
                const isSuspended = entry.projectStatus === "suspended";
                const progressRate = calcRate(
                  entry.progressTarget,
                  entry.progressActual
                );
                const budgetRate = calcRate(
                  entry.budgetTarget,
                  entry.budgetActual
                );

                return (
                  <TableRow
                    key={idx}
                    className={cn(isSuspended && "opacity-40")}
                  >
                    <TableCell className="px-1 py-1 text-xs text-center text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="px-1 py-1 text-xs font-medium">
                      {entry.projectName || "(chưa đặt tên)"}
                    </TableCell>
                    <TableCell className="px-1 py-1">
                      <Badge
                        variant={isSuspended ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {STATUS_LABEL[entry.projectStatus] || entry.projectStatus}
                      </Badge>
                    </TableCell>

                    {/* Budget Target */}
                    <TableCell className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center"
                        value={entry.budgetTarget ?? ""}
                        onChange={(e) =>
                          updateEntry(idx, {
                            budgetTarget: parseNum(e.target.value),
                          })
                        }
                        readOnly={readOnly || isSuspended}
                        disabled={readOnly || isSuspended}
                        placeholder="-"
                      />
                    </TableCell>
                    {/* Budget Actual */}
                    <TableCell className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center"
                        value={entry.budgetActual ?? ""}
                        onChange={(e) =>
                          updateEntry(idx, {
                            budgetActual: parseNum(e.target.value),
                          })
                        }
                        readOnly={readOnly || isSuspended}
                        disabled={readOnly || isSuspended}
                        placeholder="-"
                      />
                    </TableCell>
                    {/* Budget Secured */}
                    <TableCell className="px-1 py-1">
                      {!isSuspended ? (
                        <YesNoToggle
                          value={entry.budgetSecured}
                          onChange={(v) =>
                            updateEntry(idx, { budgetSecured: v })
                          }
                          readOnly={readOnly}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* Budget Ratio */}
                    <TableCell className="px-1 py-1">
                      {!isSuspended ? (
                        <PrioritySelector
                          value={entry.budgetRatio}
                          onChange={(v) =>
                            updateEntry(idx, { budgetRatio: v })
                          }
                          mode="compliance"
                          readOnly={readOnly}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Progress Target */}
                    <TableCell className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center"
                        value={entry.progressTarget ?? ""}
                        onChange={(e) =>
                          updateEntry(idx, {
                            progressTarget: parseNum(e.target.value),
                          })
                        }
                        readOnly={readOnly || isSuspended}
                        disabled={readOnly || isSuspended}
                        placeholder="-"
                      />
                    </TableCell>
                    {/* Progress Actual */}
                    <TableCell className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs text-center"
                        value={entry.progressActual ?? ""}
                        onChange={(e) =>
                          updateEntry(idx, {
                            progressActual: parseNum(e.target.value),
                          })
                        }
                        readOnly={readOnly || isSuspended}
                        disabled={readOnly || isSuspended}
                        placeholder="-"
                      />
                    </TableCell>
                    {/* Achievement Rate */}
                    <TableCell className="px-1 py-1">
                      <div
                        className={cn(
                          "flex h-7 items-center justify-center rounded-md border text-xs font-medium",
                          progressRate !== null && progressRate < 80
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-input bg-muted/50 text-foreground"
                        )}
                      >
                        {progressRate !== null
                          ? `${progressRate.toFixed(1)}%`
                          : "-"}
                      </div>
                    </TableCell>

                    {/* Self Evaluation */}
                    <TableCell className="px-1 py-1">
                      {!isSuspended ? (
                        <SelfEvaluationCell
                          evaluation={entry.selfEvaluation}
                          improvementNeeds={entry.improvementNeeds}
                          onEvaluationChange={(v) =>
                            updateEntry(idx, { selfEvaluation: v })
                          }
                          onImprovementChange={(v) =>
                            updateEntry(idx, { improvementNeeds: v })
                          }
                          readOnly={readOnly}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Tạm dừng
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Summary Row */}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell
                  colSpan={3}
                  className="px-1 py-2 text-xs text-right"
                >
                  Tổng hợp
                </TableCell>
                <TableCell colSpan={4} className="px-1 py-2 text-xs text-center">
                  {step2Summary.avgBudgetRate !== null ? (
                    <Badge variant="outline" className="text-xs">
                      TB huy động:{" "}
                      {step2Summary.avgBudgetRate.toFixed(1)}%
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell colSpan={3} className="px-1 py-2 text-xs text-center">
                  {step2Summary.avgProgressRate !== null ? (
                    <Badge variant="outline" className="text-xs">
                      TB đạt:{" "}
                      {step2Summary.avgProgressRate.toFixed(1)}%
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="px-1 py-2" />
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          PY-04. Kết quả triển khai dự án quan trọng (Điều 55.4)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tabBar}
        <Separator className="mb-4" />
        {activeStep === 1 ? step1Content : step2Content}
      </CardContent>
    </Card>
  );
}
