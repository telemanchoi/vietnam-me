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
import { YesNoToggle } from "./shared/yes-no-toggle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MandatoryGoal {
  name: string;
  targetLevel: string;
  achievementStatus: string;
  nonAchievementReason: string;
  nextPeriodForecast: string;
  selfEvaluation: string;
}

interface VoluntaryGoal {
  name: string;
  settingReason: string;
  targetLevel: string;
  achievementStatus: string;
  nonAchievementReason: string;
  nextPeriodForecast: string;
  selfEvaluation: string;
}

interface PY08Data {
  step1: {
    mandatoryGoals: MandatoryGoal[];
  };
  step2: {
    enabled: boolean;
    voluntaryGoals: VoluntaryGoal[];
  };
}

interface FormPY08GoalsProps {
  value: Partial<PY08Data>;
  onChange: (data: PY08Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANDATORY_GOAL_NAMES = [
  "Tốc độ tăng trưởng GDP",
  "GDP bình quân đầu người",
  "Tỷ lệ đô thị hóa",
  "Chỉ số phát triển con người HDI",
] as const;

const MAX_VOLUNTARY_GOALS = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyMandatoryGoal(name: string): MandatoryGoal {
  return {
    name,
    targetLevel: "",
    achievementStatus: "",
    nonAchievementReason: "",
    nextPeriodForecast: "",
    selfEvaluation: "",
  };
}

function emptyVoluntaryGoal(): VoluntaryGoal {
  return {
    name: "",
    settingReason: "",
    targetLevel: "",
    achievementStatus: "",
    nonAchievementReason: "",
    nextPeriodForecast: "",
    selfEvaluation: "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY08Goals({
  value,
  onChange,
  readOnly = false,
}: FormPY08GoalsProps) {
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  // Normalise incoming data
  const data: PY08Data = useMemo(
    () => ({
      step1: {
        mandatoryGoals:
          value?.step1?.mandatoryGoals ??
          MANDATORY_GOAL_NAMES.map((n) => emptyMandatoryGoal(n)),
      },
      step2: {
        enabled: value?.step2?.enabled ?? false,
        voluntaryGoals: value?.step2?.voluntaryGoals ?? [],
      },
    }),
    [value]
  );

  // --- Step 1 mutations ---

  const updateMandatory = useCallback(
    (index: number, patch: Partial<MandatoryGoal>) => {
      const mandatoryGoals = data.step1.mandatoryGoals.map((g, i) =>
        i === index ? { ...g, ...patch } : g
      );
      onChange({ ...data, step1: { mandatoryGoals } });
    },
    [data, onChange]
  );

  // --- Step 2 mutations ---

  const setStep2Enabled = useCallback(
    (enabled: boolean) => {
      const voluntaryGoals = enabled
        ? data.step2.voluntaryGoals.length > 0
          ? data.step2.voluntaryGoals
          : [emptyVoluntaryGoal()]
        : data.step2.voluntaryGoals;
      onChange({ ...data, step2: { enabled, voluntaryGoals } });
    },
    [data, onChange]
  );

  const updateVoluntary = useCallback(
    (index: number, patch: Partial<VoluntaryGoal>) => {
      const voluntaryGoals = data.step2.voluntaryGoals.map((g, i) =>
        i === index ? { ...g, ...patch } : g
      );
      onChange({ ...data, step2: { ...data.step2, voluntaryGoals } });
    },
    [data, onChange]
  );

  const addVoluntary = useCallback(() => {
    if (data.step2.voluntaryGoals.length >= MAX_VOLUNTARY_GOALS) return;
    onChange({
      ...data,
      step2: {
        ...data.step2,
        voluntaryGoals: [...data.step2.voluntaryGoals, emptyVoluntaryGoal()],
      },
    });
  }, [data, onChange]);

  const removeVoluntary = useCallback(
    (index: number) => {
      onChange({
        ...data,
        step2: {
          ...data.step2,
          voluntaryGoals: data.step2.voluntaryGoals.filter(
            (_, i) => i !== index
          ),
        },
      });
    },
    [data, onChange]
  );

  // --- Summary ---
  const mandatorySummary = useMemo(() => {
    const filled = data.step1.mandatoryGoals.filter(
      (g) => g.achievementStatus.trim() !== ""
    );
    return {
      total: data.step1.mandatoryGoals.length,
      filled: filled.length,
    };
  }, [data.step1.mandatoryGoals]);

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
        1단계: Mục tiêu bắt buộc
      </Button>
      <Button
        type="button"
        variant={activeStep === 2 ? "default" : "outline"}
        size="sm"
        className="text-xs"
        onClick={() => setActiveStep(2)}
      >
        2단계: Mục tiêu tự nguyện
      </Button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Goal Table (reused for both steps)
  // ---------------------------------------------------------------------------

  function renderGoalTable(
    goals: (MandatoryGoal | VoluntaryGoal)[],
    updateFn: (index: number, patch: Partial<MandatoryGoal & VoluntaryGoal>) => void,
    options: {
      showSettingReason?: boolean;
      showName?: boolean;
      removable?: boolean;
      onRemove?: (index: number) => void;
    } = {}
  ) {
    const {
      showSettingReason = false,
      showName = false,
      removable = false,
      onRemove,
    } = options;

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs h-8 px-1 w-8">#</TableHead>
              <TableHead className="text-xs h-8 px-1 min-w-[160px]">
                {showName ? "Mục tiêu tự nguyện" : "Hạng mục bắt buộc"}
              </TableHead>
              {showSettingReason && (
                <TableHead className="text-xs h-8 px-1 min-w-[140px]">
                  Lý do thiết lập
                </TableHead>
              )}
              <TableHead className="text-xs h-8 px-1 min-w-[120px]">
                Mức mục tiêu
              </TableHead>
              <TableHead className="text-xs h-8 px-1 min-w-[120px]">
                Đạt / Tỷ lệ đạt
              </TableHead>
              <TableHead className="text-xs h-8 px-1 min-w-[160px]">
                Lý do chưa đạt
              </TableHead>
              <TableHead className="text-xs h-8 px-1 min-w-[120px]">
                Dự báo kỳ tiếp
              </TableHead>
              <TableHead className="text-xs h-8 px-1 min-w-[160px]">
                Tự đánh giá
              </TableHead>
              {removable && !readOnly && (
                <TableHead className="text-xs h-8 px-1 w-8" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    7 +
                    (showSettingReason ? 1 : 0) +
                    (removable && !readOnly ? 1 : 0)
                  }
                  className="text-center text-xs text-muted-foreground py-4"
                >
                  Chưa có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              goals.map((goal, idx) => (
                <TableRow key={idx}>
                  <TableCell className="px-1 py-1 text-xs text-center text-muted-foreground">
                    {idx + 1}
                  </TableCell>

                  {/* Name */}
                  <TableCell className="px-1 py-1">
                    {showName ? (
                      <Input
                        type="text"
                        className="h-7 text-xs"
                        placeholder="Nhập tên mục tiêu"
                        value={goal.name}
                        onChange={(e) =>
                          updateFn(idx, { name: e.target.value })
                        }
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    ) : (
                      <span className="text-xs font-medium">{goal.name}</span>
                    )}
                  </TableCell>

                  {/* Setting Reason (voluntary only) */}
                  {showSettingReason && (
                    <TableCell className="px-1 py-1">
                      <Input
                        type="text"
                        className="h-7 text-xs"
                        placeholder="Nhập lý do"
                        value={(goal as VoluntaryGoal).settingReason ?? ""}
                        onChange={(e) =>
                          updateFn(idx, { settingReason: e.target.value })
                        }
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </TableCell>
                  )}

                  {/* Target Level */}
                  <TableCell className="px-1 py-1">
                    <Input
                      type="text"
                      className="h-7 text-xs"
                      placeholder="VD: 6.5~7.5%"
                      value={goal.targetLevel}
                      onChange={(e) =>
                        updateFn(idx, { targetLevel: e.target.value })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </TableCell>

                  {/* Achievement Status */}
                  <TableCell className="px-1 py-1">
                    <Input
                      type="text"
                      className="h-7 text-xs"
                      placeholder="VD: 85% hoặc Đạt"
                      value={goal.achievementStatus}
                      onChange={(e) =>
                        updateFn(idx, {
                          achievementStatus: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </TableCell>

                  {/* Non-achievement Reason */}
                  <TableCell className="px-1 py-1">
                    <Textarea
                      className="min-h-[40px] text-xs resize-none"
                      placeholder="Lý do chưa đạt (nếu < 80%)"
                      value={goal.nonAchievementReason}
                      onChange={(e) =>
                        updateFn(idx, {
                          nonAchievementReason: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </TableCell>

                  {/* Next Period Forecast */}
                  <TableCell className="px-1 py-1">
                    <Input
                      type="text"
                      className="h-7 text-xs"
                      placeholder="Dự báo"
                      value={goal.nextPeriodForecast}
                      onChange={(e) =>
                        updateFn(idx, {
                          nextPeriodForecast: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </TableCell>

                  {/* Self Evaluation */}
                  <TableCell className="px-1 py-1">
                    <Textarea
                      className="min-h-[40px] text-xs resize-none"
                      placeholder="Nhập tự đánh giá"
                      value={goal.selfEvaluation}
                      onChange={(e) =>
                        updateFn(idx, {
                          selfEvaluation: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </TableCell>

                  {/* Remove button */}
                  {removable && !readOnly && (
                    <TableCell className="px-1 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove?.(idx)}
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
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1 - Mandatory Goals
  // ---------------------------------------------------------------------------

  const step1Content = (
    <div className="flex flex-col gap-3">
      {renderGoalTable(data.step1.mandatoryGoals, updateMandatory)}

      {/* Summary row */}
      <div className="flex items-center gap-3 px-1">
        <Badge variant="outline" className="text-xs">
          Tổng hợp: {mandatorySummary.filled}/{mandatorySummary.total} mục tiêu
          đã đánh giá
        </Badge>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step 2 - Voluntary Goals
  // ---------------------------------------------------------------------------

  const step2Content = (
    <div className="flex flex-col gap-4">
      {/* Opt-in question */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
        <span className="text-xs font-medium">
          Bạn có muốn đánh giá kết quả thực hiện mục tiêu tự nguyện không?
        </span>
        <YesNoToggle
          value={data.step2.enabled}
          onChange={(v) => {
            if (!readOnly) setStep2Enabled(v);
          }}
          readOnly={readOnly}
        />
      </div>

      {data.step2.enabled && (
        <>
          {renderGoalTable(data.step2.voluntaryGoals, updateVoluntary, {
            showSettingReason: true,
            showName: true,
            removable: true,
            onRemove: removeVoluntary,
          })}

          {!readOnly &&
            data.step2.voluntaryGoals.length < MAX_VOLUNTARY_GOALS && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="self-start text-xs gap-1"
                onClick={addVoluntary}
              >
                <Plus className="size-3" />
                Thêm mục tiêu (tối đa {MAX_VOLUNTARY_GOALS})
              </Button>
            )}

          {data.step2.voluntaryGoals.length >= MAX_VOLUNTARY_GOALS && (
            <p className="text-xs text-muted-foreground">
              Đã đạt tối đa {MAX_VOLUNTARY_GOALS} mục tiêu tự nguyện.
            </p>
          )}
        </>
      )}

      {!data.step2.enabled && (
        <p className="text-xs text-muted-foreground italic px-1">
          Chọn &quot;Có&quot; để đánh giá mục tiêu tự nguyện.
        </p>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          PY-08. Kết quả thực hiện mục tiêu, chỉ tiêu (Điều 55.8)
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
