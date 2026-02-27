"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PrioritySelectorProps {
  value: string | null;
  onChange: (v: string) => void;
  mode?: "priority" | "compliance";
  readOnly?: boolean;
}

const PRIORITY_OPTIONS = [
  {
    value: "high",
    label: "Cao",
    activeClass: "bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-600",
  },
  {
    value: "medium",
    label: "Trung bình",
    activeClass: "bg-yellow-500 text-white hover:bg-yellow-600 hover:text-white border-yellow-500",
  },
  {
    value: "low",
    label: "Thấp",
    activeClass: "bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-600",
  },
] as const;

const COMPLIANCE_OPTIONS = [
  {
    value: "appropriate",
    label: "Phù hợp",
    activeClass: "bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-600",
  },
  {
    value: "inappropriate",
    label: "Không phù hợp",
    activeClass: "bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-600",
  },
] as const;

export function PrioritySelector({
  value,
  onChange,
  mode = "priority",
  readOnly = false,
}: PrioritySelectorProps) {
  const options = mode === "priority" ? PRIORITY_OPTIONS : COMPLIANCE_OPTIONS;

  return (
    <div className="inline-flex gap-1">
      {options.map((opt) => {
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
