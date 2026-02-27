"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface YesNoToggleProps {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label?: string;
  readOnly?: boolean;
}

export function YesNoToggle({
  value,
  onChange,
  label,
  readOnly = false,
}: YesNoToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      )}
      <div className="inline-flex rounded-md border overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            "rounded-none border-r px-3 text-xs font-medium transition-colors",
            value === true
              ? "bg-green-600 text-white hover:bg-green-700 hover:text-white"
              : "text-muted-foreground hover:bg-muted"
          )}
          onClick={() => {
            if (!readOnly) onChange(true);
          }}
          disabled={readOnly}
        >
          Có
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            "rounded-none px-3 text-xs font-medium transition-colors",
            value === false
              ? "bg-red-600 text-white hover:bg-red-700 hover:text-white"
              : "text-muted-foreground hover:bg-muted"
          )}
          onClick={() => {
            if (!readOnly) onChange(false);
          }}
          disabled={readOnly}
        >
          Không
        </Button>
      </div>
    </div>
  );
}
