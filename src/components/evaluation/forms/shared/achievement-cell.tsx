"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AchievementCellProps {
  target: number | null;
  actual: number | null;
  onTargetChange: (v: number | null) => void;
  onActualChange: (v: number | null) => void;
  nonAchievementReason?: string;
  onReasonChange?: (v: string) => void;
  readOnly?: boolean;
}

function parseNumericInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

export function AchievementCell({
  target,
  actual,
  onTargetChange,
  onActualChange,
  nonAchievementReason,
  onReasonChange,
  readOnly = false,
}: AchievementCellProps) {
  const rate =
    target !== null && actual !== null && target !== 0
      ? (actual / target) * 100
      : null;

  const isBelowThreshold = rate !== null && rate < 80;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-3 gap-1">
        {/* Target */}
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground leading-none mb-0.5">
            Mục tiêu
          </span>
          <Input
            type="number"
            className="h-7 text-xs text-center"
            value={target ?? ""}
            onChange={(e) => onTargetChange(parseNumericInput(e.target.value))}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder="-"
          />
        </div>

        {/* Actual */}
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground leading-none mb-0.5">
            Thực tế
          </span>
          <Input
            type="number"
            className="h-7 text-xs text-center"
            value={actual ?? ""}
            onChange={(e) => onActualChange(parseNumericInput(e.target.value))}
            readOnly={readOnly}
            disabled={readOnly}
            placeholder="-"
          />
        </div>

        {/* Achievement Rate */}
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground leading-none mb-0.5">
            Đạt (%)
          </span>
          <div
            className={cn(
              "flex h-7 items-center justify-center rounded-md border text-xs font-medium",
              isBelowThreshold
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-input bg-muted/50 text-foreground"
            )}
          >
            {rate !== null ? `${rate.toFixed(1)}%` : "-"}
          </div>
        </div>
      </div>

      {isBelowThreshold && (
        <Textarea
          className="min-h-[48px] text-xs resize-none"
          placeholder="Lý do chưa đạt mục tiêu"
          value={nonAchievementReason ?? ""}
          onChange={(e) => onReasonChange?.(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      )}
    </div>
  );
}
