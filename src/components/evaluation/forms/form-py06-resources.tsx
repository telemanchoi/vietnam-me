"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface BudgetRow {
  type: string;
  targetLevel: number | null;
  actualLevel: number | null;
  nonAchievementReason: string;
  futurePlan: string;
  selfEvaluation: string;
}

interface OrganizationData {
  executionOrg: string;
  supervisionFunction: string;
  selfEvaluation: string;
}

interface LegalBasisData {
  laws: string;
  otherInstitutional: string;
  selfEvaluation: string;
}

export interface PY06Data {
  budget: BudgetRow[];
  organization: OrganizationData;
  legalBasis: LegalBasisData;
}

// ---------------------------------------------------------------------------
// Constants & defaults
// ---------------------------------------------------------------------------

const BUDGET_TYPE_LABELS: { type: string; label: string }[] = [
  { type: "national", label: "Ngân sách nhà nước" },
  { type: "local", label: "Ngân sách địa phương" },
  { type: "ppp", label: "PPP (Đầu tư tư nhân)" },
  { type: "foreign", label: "Vốn nước ngoài" },
  { type: "other", label: "Nguồn khác" },
];

function createDefaultBudgetRow(type: string): BudgetRow {
  return {
    type,
    targetLevel: null,
    actualLevel: null,
    nonAchievementReason: "",
    futurePlan: "",
    selfEvaluation: "",
  };
}

export function createDefaultPY06Data(): PY06Data {
  return {
    budget: BUDGET_TYPE_LABELS.map((bt) => createDefaultBudgetRow(bt.type)),
    organization: {
      executionOrg: "",
      supervisionFunction: "",
      selfEvaluation: "",
    },
    legalBasis: {
      laws: "",
      otherInstitutional: "",
      selfEvaluation: "",
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumericInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

function computeRate(target: number | null, actual: number | null): number | null {
  if (target === null || actual === null || target === 0) return null;
  return (actual / target) * 100;
}

function getBudgetTypeLabel(type: string): string {
  return BUDGET_TYPE_LABELS.find((bt) => bt.type === type)?.label ?? type;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FormPY06ResourcesProps {
  value: PY06Data;
  onChange: (data: PY06Data) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormPY06Resources({
  value,
  onChange,
  readOnly = false,
}: FormPY06ResourcesProps) {
  const data: PY06Data =
    value?.budget?.length === 5 ? value : createDefaultPY06Data();

  const updateBudgetRow = (index: number, patch: Partial<BudgetRow>) => {
    const updated = data.budget.map((row, i) =>
      i === index ? { ...row, ...patch } : row
    );
    onChange({ ...data, budget: updated });
  };

  const updateOrganization = (patch: Partial<OrganizationData>) => {
    onChange({ ...data, organization: { ...data.organization, ...patch } });
  };

  const updateLegalBasis = (patch: Partial<LegalBasisData>) => {
    onChange({ ...data, legalBasis: { ...data.legalBasis, ...patch } });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ----------------------------------------------------------------- */}
      {/* Sub-table 1: Budget / Finance                                      */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Nguồn lực tài chính / Ngân sách
            <Badge variant="outline" className="text-[10px] font-normal">
              Điều 55.6
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8 px-2 w-8 text-center">
                    #
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[150px]">
                    Nguồn vốn
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[100px] text-center">
                    Mục tiêu
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[100px] text-center">
                    Thực tế
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[90px] text-center">
                    Tỷ lệ (%)
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[150px]">
                    Lý do chưa đạt
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[150px]">
                    Kế hoạch tới
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[150px]">
                    Tự đánh giá
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.budget.map((row, idx) => {
                  const rate = computeRate(row.targetLevel, row.actualLevel);
                  const isBelowThreshold = rate !== null && rate < 80;

                  return (
                    <TableRow key={row.type}>
                      {/* Row number */}
                      <TableCell className="px-2 py-1.5 text-xs text-center text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Budget type */}
                      <TableCell className="px-2 py-1.5">
                        <span className="text-xs font-medium">
                          {getBudgetTypeLabel(row.type)}
                        </span>
                      </TableCell>

                      {/* Target level */}
                      <TableCell className="px-2 py-1.5">
                        <Input
                          type="number"
                          className="h-7 text-xs text-center"
                          value={row.targetLevel ?? ""}
                          onChange={(e) =>
                            updateBudgetRow(idx, {
                              targetLevel: parseNumericInput(e.target.value),
                            })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                          placeholder="-"
                        />
                      </TableCell>

                      {/* Actual level */}
                      <TableCell className="px-2 py-1.5">
                        <Input
                          type="number"
                          className="h-7 text-xs text-center"
                          value={row.actualLevel ?? ""}
                          onChange={(e) =>
                            updateBudgetRow(idx, {
                              actualLevel: parseNumericInput(e.target.value),
                            })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                          placeholder="-"
                        />
                      </TableCell>

                      {/* Rate (auto-calculated) */}
                      <TableCell className="px-2 py-1.5">
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
                      </TableCell>

                      {/* Non-achievement reason */}
                      <TableCell className="px-2 py-1.5">
                        {isBelowThreshold ? (
                          <Textarea
                            className="min-h-[40px] text-xs resize-none border-red-200"
                            value={row.nonAchievementReason}
                            onChange={(e) =>
                              updateBudgetRow(idx, {
                                nonAchievementReason: e.target.value,
                              })
                            }
                            readOnly={readOnly}
                            disabled={readOnly}
                            placeholder="Nhập lý do chưa đạt 80%"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>

                      {/* Future plan */}
                      <TableCell className="px-2 py-1.5">
                        <Textarea
                          className="min-h-[40px] text-xs resize-none"
                          value={row.futurePlan}
                          onChange={(e) =>
                            updateBudgetRow(idx, {
                              futurePlan: e.target.value,
                            })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                          placeholder="Kế hoạch sắp tới"
                        />
                      </TableCell>

                      {/* Self evaluation */}
                      <TableCell className="px-2 py-1.5">
                        <Textarea
                          className="min-h-[40px] text-xs resize-none"
                          value={row.selfEvaluation}
                          onChange={(e) =>
                            updateBudgetRow(idx, {
                              selfEvaluation: e.target.value,
                            })
                          }
                          readOnly={readOnly}
                          disabled={readOnly}
                          placeholder="Nhập tự đánh giá"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Sub-table 2: Implementation Organization                           */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Tổ chức thực hiện & Quy mô nhân lực
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8 px-2 min-w-[200px]">
                    Hệ thống tổ chức thực hiện
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[200px]">
                    Chức năng quản lý, giám sát
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[200px]">
                    Tự đánh giá
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {/* Execution organization */}
                  <TableCell className="px-2 py-1.5 align-top">
                    <Textarea
                      className="min-h-[80px] text-xs resize-none"
                      value={data.organization.executionOrg}
                      onChange={(e) =>
                        updateOrganization({ executionOrg: e.target.value })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                      placeholder="Mô tả hệ thống tổ chức thực hiện, phân công nhiệm vụ, cơ cấu nhân sự..."
                    />
                  </TableCell>

                  {/* Supervision function */}
                  <TableCell className="px-2 py-1.5 align-top">
                    <Textarea
                      className="min-h-[80px] text-xs resize-none"
                      value={data.organization.supervisionFunction}
                      onChange={(e) =>
                        updateOrganization({
                          supervisionFunction: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                      placeholder="Mô tả chức năng quản lý, giám sát, kiểm tra..."
                    />
                  </TableCell>

                  {/* Self evaluation */}
                  <TableCell className="px-2 py-1.5 align-top">
                    <Textarea
                      className="min-h-[80px] text-xs resize-none"
                      value={data.organization.selfEvaluation}
                      onChange={(e) =>
                        updateOrganization({
                          selfEvaluation: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                      placeholder="Nhập tự đánh giá"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Sub-table 3: Legal / Institutional Basis                           */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Căn cứ pháp lý / Thể chế
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8 px-2 min-w-[220px]">
                    Văn bản pháp luật (Luật, Nghị định, Quyết định...)
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[220px]">
                    Thể chế, hành chính khác
                  </TableHead>
                  <TableHead className="text-xs h-8 px-2 min-w-[200px]">
                    Tự đánh giá
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {/* Laws */}
                  <TableCell className="px-2 py-1.5 align-top">
                    <Textarea
                      className="min-h-[80px] text-xs resize-none"
                      value={data.legalBasis.laws}
                      onChange={(e) =>
                        updateLegalBasis({ laws: e.target.value })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                      placeholder="Liệt kê các văn bản pháp luật liên quan (luật, nghị định, thông tư, quyết định...)"
                    />
                  </TableCell>

                  {/* Other institutional */}
                  <TableCell className="px-2 py-1.5 align-top">
                    <Textarea
                      className="min-h-[80px] text-xs resize-none"
                      value={data.legalBasis.otherInstitutional}
                      onChange={(e) =>
                        updateLegalBasis({
                          otherInstitutional: e.target.value,
                        })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                      placeholder="Các cơ chế thể chế, hành chính khác..."
                    />
                  </TableCell>

                  {/* Self evaluation */}
                  <TableCell className="px-2 py-1.5 align-top">
                    <Textarea
                      className="min-h-[80px] text-xs resize-none"
                      value={data.legalBasis.selfEvaluation}
                      onChange={(e) =>
                        updateLegalBasis({ selfEvaluation: e.target.value })
                      }
                      readOnly={readOnly}
                      disabled={readOnly}
                      placeholder="Nhập tự đánh giá"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
