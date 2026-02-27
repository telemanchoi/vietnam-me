"use client";

import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { YesNoToggle } from "./shared/yes-no-toggle";
import { ArrowDown, CheckCircle2, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface PY09Data {
  hasIssues: boolean | null;
  description: string;
  attachmentNotes: string;
}

interface PY10Data {
  hasEfforts: boolean | null;
  description: string;
}

interface PY11Data {
  needsAdjustment: boolean | null;
  description: string;
}

interface QualitativeFlowItem {
  itemCode: string; // "PY-09", "PY-10", or "PY-11"
  templateId: string;
  content: string; // JSON string
}

interface FormPY09to11Props {
  items: QualitativeFlowItem[];
  onChange: (itemCode: string, content: string) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PY09: PY09Data = {
  hasIssues: null,
  description: "",
  attachmentNotes: "",
};

const DEFAULT_PY10: PY10Data = {
  hasEfforts: null,
  description: "",
};

const DEFAULT_PY11: PY11Data = {
  needsAdjustment: null,
  description: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParse<T>(content: string | undefined | null, fallback: T): T {
  if (!content) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function StageConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center">
        <div className="w-px h-3 bg-border" />
        <ArrowDown className="size-4 text-muted-foreground" />
        <div className="w-px h-3 bg-border" />
      </div>
    </div>
  );
}

function StageBadge({
  number,
  variant,
}: {
  number: number;
  variant: "question" | "input" | "skipped";
}) {
  return (
    <Badge
      variant={variant === "skipped" ? "secondary" : "outline"}
      className={cn(
        "text-[10px] font-medium tabular-nums",
        variant === "question" && "border-blue-300 bg-blue-50 text-blue-700",
        variant === "input" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        variant === "skipped" && "text-muted-foreground"
      )}
    >
      Bước {number}
    </Badge>
  );
}

function SkippedMessage() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic py-1">
      <CheckCircle2 className="size-3.5 text-muted-foreground/60" />
      Không áp dụng
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY09to11Qualitative({
  items,
  onChange,
  readOnly = false,
}: FormPY09to11Props) {
  // ---- Parse stored data ----

  const getItemContent = useCallback(
    (code: string): string | null => {
      const item = items.find((i) => i.itemCode === code);
      return item?.content ?? null;
    },
    [items]
  );

  const py09 = useMemo(
    () => safeParse<PY09Data>(getItemContent("PY-09"), DEFAULT_PY09),
    [getItemContent]
  );
  const py10 = useMemo(
    () => safeParse<PY10Data>(getItemContent("PY-10"), DEFAULT_PY10),
    [getItemContent]
  );
  const py11 = useMemo(
    () => safeParse<PY11Data>(getItemContent("PY-11"), DEFAULT_PY11),
    [getItemContent]
  );

  // ---- Updaters ----

  const updatePY09 = useCallback(
    (patch: Partial<PY09Data>) => {
      const updated = { ...py09, ...patch };
      onChange("PY-09", JSON.stringify(updated));
    },
    [py09, onChange]
  );

  const updatePY10 = useCallback(
    (patch: Partial<PY10Data>) => {
      const updated = { ...py10, ...patch };
      onChange("PY-10", JSON.stringify(updated));
    },
    [py10, onChange]
  );

  const updatePY11 = useCallback(
    (patch: Partial<PY11Data>) => {
      const updated = { ...py11, ...patch };
      onChange("PY-11", JSON.stringify(updated));
    },
    [py11, onChange]
  );

  // ---- Visibility logic ----

  const stage1Answered = py09.hasIssues !== null;
  const showStage2 = py09.hasIssues === true;
  const showStage3 = stage1Answered;
  const stage3Answered = py10.hasEfforts !== null;
  const showStage3b = py10.hasEfforts === true;
  const showStage4 = showStage3 && stage3Answered;
  const stage4Answered = py11.needsAdjustment !== null;
  const showStage4b = py11.needsAdjustment === true;

  // ---- Render ----

  return (
    <div className="flex flex-col">
      {/* ================================================================
          STAGE 1 — Question: Issues during implementation?
          ================================================================ */}
      <Card
        className={cn(
          "transition-opacity",
          "border-blue-200/60 bg-blue-50/30"
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <StageBadge number={1} variant="question" />
            Khó khăn trong thực hiện
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Trong quá trình thực hiện quy hoạch, có vấn đề/dự án bị chậm tiến
              độ hoặc gặp khó khăn không?
            </p>
            <YesNoToggle
              value={py09.hasIssues}
              onChange={(v) => {
                updatePY09({ hasIssues: v });
                // When toggling to "No", clear PY-09 description fields
                if (!v) {
                  updatePY09({
                    hasIssues: v,
                    description: "",
                    attachmentNotes: "",
                  });
                }
              }}
              readOnly={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================
          STAGE 2 — PY-09: Describe difficulties
          ================================================================ */}
      {stage1Answered && (
        <>
          <StageConnector />

          {showStage2 ? (
            <Card className="transition-opacity">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StageBadge number={2} variant="input" />
                  <span>
                    Điều 55.9 — Khó khăn, vướng mắc và nguyên nhân
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal ml-auto"
                  >
                    PY-09
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Mô tả khó khăn, vướng mắc trong quá trình thực hiện quy
                      hoạch
                    </label>
                    <Textarea
                      className="min-h-[100px] text-sm resize-y"
                      value={py09.description}
                      onChange={(e) =>
                        updatePY09({ description: e.target.value })
                      }
                      disabled={readOnly}
                      placeholder="Nêu rõ các khó khăn, vướng mắc, nguyên nhân và tác động đến việc thực hiện quy hoạch..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Ghi chú tài liệu đính kèm (nếu có)
                    </label>
                    <Textarea
                      className="min-h-[60px] text-sm resize-y"
                      value={py09.attachmentNotes}
                      onChange={(e) =>
                        updatePY09({ attachmentNotes: e.target.value })
                      }
                      disabled={readOnly}
                      placeholder="Ví dụ: Báo cáo tiến độ dự án X, Biên bản họp ngày..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="transition-opacity opacity-50 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StageBadge number={2} variant="skipped" />
                  <span className="text-muted-foreground">
                    Điều 55.9 — Khó khăn, vướng mắc và nguyên nhân
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SkippedMessage />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ================================================================
          STAGE 3 — Question: Efficiency improvement efforts?
          ================================================================ */}
      {showStage3 && (
        <>
          <StageConnector />

          <Card
            className={cn(
              "transition-opacity",
              "border-blue-200/60 bg-blue-50/30"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <StageBadge number={3} variant="question" />
                Nỗ lực nâng cao hiệu quả
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Có nỗ lực nào nhằm nâng cao hiệu quả thực hiện quy hoạch
                  không?
                </p>
                <YesNoToggle
                  value={py10.hasEfforts}
                  onChange={(v) => {
                    // When toggling to "No", clear PY-10 description
                    if (!v) {
                      updatePY10({ hasEfforts: v, description: "" });
                    } else {
                      updatePY10({ hasEfforts: v });
                    }
                  }}
                  readOnly={readOnly}
                />
              </div>
            </CardContent>
          </Card>

          {/* STAGE 3b — PY-10: Describe efficiency efforts */}
          {stage3Answered && (
            <>
              <StageConnector />

              {showStage3b ? (
                <Card className="transition-opacity">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StageBadge number={3} variant="input" />
                      <span>
                        Điều 55.10 — Đề xuất giải pháp nâng cao hiệu quả thực
                        hiện quy hoạch
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal ml-auto"
                      >
                        PY-10
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Mô tả các giải pháp và nỗ lực nâng cao hiệu quả
                        </label>
                        <Textarea
                          className="min-h-[100px] text-sm resize-y"
                          value={py10.description}
                          onChange={(e) =>
                            updatePY10({ description: e.target.value })
                          }
                          disabled={readOnly}
                          placeholder="Trình bày các giải pháp đã và đang thực hiện nhằm nâng cao hiệu quả thực hiện quy hoạch..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="transition-opacity opacity-50 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StageBadge number={3} variant="skipped" />
                      <span className="text-muted-foreground">
                        Điều 55.10 — Đề xuất giải pháp nâng cao hiệu quả
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SkippedMessage />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ================================================================
          STAGE 4 — Question: Need plan adjustments?
          ================================================================ */}
      {showStage4 && (
        <>
          <StageConnector />

          <Card
            className={cn(
              "transition-opacity",
              "border-blue-200/60 bg-blue-50/30"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <StageBadge number={4} variant="question" />
                Điều chỉnh quy hoạch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Có cần điều chỉnh quy hoạch không?
                </p>
                <YesNoToggle
                  value={py11.needsAdjustment}
                  onChange={(v) => {
                    // When toggling to "No", clear PY-11 description
                    if (!v) {
                      updatePY11({ needsAdjustment: v, description: "" });
                    } else {
                      updatePY11({ needsAdjustment: v });
                    }
                  }}
                  readOnly={readOnly}
                />
              </div>
            </CardContent>
          </Card>

          {/* STAGE 4b — PY-11: Describe plan adjustments */}
          {stage4Answered && (
            <>
              <StageConnector />

              {showStage4b ? (
                <Card className="transition-opacity">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StageBadge number={4} variant="input" />
                      <span>
                        Điều 55.11 — Kiến nghị điều chỉnh quy hoạch
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal ml-auto"
                      >
                        PY-11
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Mô tả đề xuất điều chỉnh quy hoạch
                        </label>
                        <Textarea
                          className="min-h-[100px] text-sm resize-y"
                          value={py11.description}
                          onChange={(e) =>
                            updatePY11({ description: e.target.value })
                          }
                          disabled={readOnly}
                          placeholder="Trình bày các đề xuất cụ thể về điều chỉnh quy hoạch, lý do và phạm vi điều chỉnh..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="transition-opacity opacity-50 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StageBadge number={4} variant="skipped" />
                      <span className="text-muted-foreground">
                        Điều 55.11 — Kiến nghị điều chỉnh quy hoạch
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SkippedMessage />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ================================================================
          Flow completion indicator
          ================================================================ */}
      {showStage4 && stage4Answered && (
        <>
          <StageConnector />
          <div className="flex items-center justify-center gap-2 py-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">
              Hoàn thành đánh giá định tính
            </span>
          </div>
        </>
      )}
    </div>
  );
}
