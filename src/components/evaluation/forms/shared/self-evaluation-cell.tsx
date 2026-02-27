"use client";

import { Textarea } from "@/components/ui/textarea";

interface SelfEvaluationCellProps {
  evaluation: string;
  improvementNeeds: string;
  onEvaluationChange: (v: string) => void;
  onImprovementChange: (v: string) => void;
  readOnly?: boolean;
}

export function SelfEvaluationCell({
  evaluation,
  improvementNeeds,
  onEvaluationChange,
  onImprovementChange,
  readOnly = false,
}: SelfEvaluationCellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground leading-none">
          Tự đánh giá
        </span>
        <Textarea
          className="min-h-[40px] text-xs resize-none"
          placeholder="Nhập nội dung tự đánh giá"
          value={evaluation}
          onChange={(e) => onEvaluationChange(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground leading-none">
          Cần cải thiện
        </span>
        <Textarea
          className="min-h-[40px] text-xs resize-none"
          placeholder="Nhập nội dung cần cải thiện"
          value={improvementNeeds}
          onChange={(e) => onImprovementChange(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
