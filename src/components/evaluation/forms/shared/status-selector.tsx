"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface StatusSelectorProps {
  value: string;
  reason?: string;
  stage?: string;
  onChange: (status: string, reason?: string, stage?: string) => void;
  readOnly?: boolean;
}

const STATUS_OPTIONS = [
  { value: "preparation", label: "Chuẩn bị triển khai" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "completed", label: "Hoàn thành" },
  { value: "suspended", label: "Tạm dừng" },
] as const;

export function StatusSelector({
  value,
  reason,
  stage,
  onChange,
  readOnly = false,
}: StatusSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "suspended") {
            onChange(v, reason ?? "", undefined);
          } else if (v === "in_progress") {
            onChange(v, undefined, stage ?? "");
          } else {
            onChange(v, undefined, undefined);
          }
        }}
        disabled={readOnly}
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue placeholder="Chọn trạng thái" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "in_progress" && (
        <Input
          className="h-7 text-xs"
          placeholder="Giai đoạn thực hiện"
          value={stage ?? ""}
          onChange={(e) => onChange(value, undefined, e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      )}

      {value === "suspended" && (
        <Input
          className="h-7 text-xs"
          placeholder="Lý do tạm dừng"
          value={reason ?? ""}
          onChange={(e) => onChange(value, e.target.value, undefined)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      )}
    </div>
  );
}
