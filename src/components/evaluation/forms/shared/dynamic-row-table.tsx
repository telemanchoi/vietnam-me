"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, X } from "lucide-react";

export interface Column {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "custom";
  width?: string;
  options?: { value: string; label: string }[];
  render?: (
    value: any,
    rowIndex: number,
    onChange: (v: any) => void,
    readOnly: boolean
  ) => React.ReactNode;
}

interface DynamicRowTableProps {
  columns: Column[];
  rows: Record<string, any>[];
  onChange: (rows: Record<string, any>[]) => void;
  readOnly?: boolean;
  addLabel?: string;
  minRows?: number;
}

function createEmptyRow(columns: Column[]): Record<string, any> {
  const row: Record<string, any> = {};
  for (const col of columns) {
    row[col.key] = col.type === "number" ? null : "";
  }
  return row;
}

export function DynamicRowTable({
  columns,
  rows,
  onChange,
  readOnly = false,
  addLabel = "Thêm dòng",
  minRows = 0,
}: DynamicRowTableProps) {
  const handleCellChange = (
    rowIndex: number,
    key: string,
    value: any
  ) => {
    const updated = rows.map((row, i) =>
      i === rowIndex ? { ...row, [key]: value } : row
    );
    onChange(updated);
  };

  const handleAddRow = () => {
    onChange([...rows, createEmptyRow(columns)]);
  };

  const handleRemoveRow = (rowIndex: number) => {
    if (rows.length <= minRows) return;
    onChange(rows.filter((_, i) => i !== rowIndex));
  };

  const renderCell = (
    col: Column,
    row: Record<string, any>,
    rowIndex: number
  ) => {
    const cellValue = row[col.key];
    const cellOnChange = (v: any) => handleCellChange(rowIndex, col.key, v);

    if (col.type === "custom" && col.render) {
      return col.render(cellValue, rowIndex, cellOnChange, readOnly);
    }

    if (col.type === "select" && col.options) {
      return (
        <Select
          value={cellValue ?? ""}
          onValueChange={cellOnChange}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue placeholder="Chọn" />
          </SelectTrigger>
          <SelectContent>
            {col.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (col.type === "number") {
      return (
        <Input
          type="number"
          className="h-7 text-xs"
          value={cellValue ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            cellOnChange(raw === "" ? null : parseFloat(raw));
          }}
          readOnly={readOnly}
          disabled={readOnly}
        />
      );
    }

    // default: text
    return (
      <Input
        type="text"
        className="h-7 text-xs"
        value={cellValue ?? ""}
        onChange={(e) => cellOnChange(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
      />
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="text-xs h-8 px-1"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </TableHead>
            ))}
            {!readOnly && (
              <TableHead className="w-8 h-8 px-1" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (readOnly ? 0 : 1)}
                className="text-center text-xs text-muted-foreground py-3"
              >
                Chưa có dữ liệu
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className="px-1 py-1"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {renderCell(col, row, rowIndex)}
                  </TableCell>
                ))}
                {!readOnly && (
                  <TableCell className="px-1 py-1 w-8">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveRow(rowIndex)}
                      disabled={rows.length <= minRows}
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
          className="self-start text-xs gap-1"
          onClick={handleAddRow}
        >
          <Plus className="size-3" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
