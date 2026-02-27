"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  FileText,
  Target,
  TableIcon,
  Building2,
  Calendar,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Serialized } from "@/lib/serialize";
import type { PlanDetail as PlanDetailType } from "@/lib/queries/plans";

type Plan = Serialized<PlanDetailType>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const LEVEL_INDENT: Record<string, string> = {
  DIEU: "ml-0",
  ROMAN: "ml-4",
  ARABIC: "ml-8",
  LETTER: "ml-12",
  DASH: "ml-16",
};

const TARGET_TYPE_COLORS: Record<string, string> = {
  QUANTITATIVE: "bg-blue-100 text-blue-700",
  QUALITATIVE: "bg-green-100 text-green-700",
  MILESTONE: "bg-orange-100 text-orange-700",
};

interface SectionNode {
  id: string;
  level: string;
  sectionNumber: string;
  titleVi: string | null;
  contentVi: string | null;
  sortOrder: number;
  _count: { children: number; targets: number };
  children?: SectionNode[];
  targets?: TargetNode[];
  loaded?: boolean;
}

interface TargetNode {
  id: string;
  targetType: string;
  nameVi: string;
  unit: string | null;
  targetValue: number | null;
  targetYear: number | null;
  baselineValue: number | null;
  baselineYear: number | null;
  targetMin: number | null;
  targetMax: number | null;
  rawTextVi: string | null;
}

interface AllTarget extends TargetNode {
  section: { sectionNumber: string; titleVi: string | null };
}

interface AppendixNode {
  id: string;
  appendixNumber: number;
  titleVi: string;
  appendixType: string;
  sortOrder: number;
  _count: { rows: number };
}

interface AppendixRowData {
  id: string;
  rowNumber: number;
  data: Record<string, unknown>;
  sortOrder: number;
}

export function PlanDetail({ plan }: { plan: Plan }) {
  const t = useTranslations("plans");
  const locale = useLocale();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/plans`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-bold leading-tight">{plan.nameVi}</h1>
          {plan.nameEn && (
            <p className="text-muted-foreground">{plan.nameEn}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {plan.planType && (
              <Badge variant="outline">{plan.planType.nameVi}</Badge>
            )}
            <Badge variant="secondary" className={STATUS_COLORS[plan.status] ?? ""}>
              {t(`status.${plan.status}`)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              {plan.periodStart}–{plan.periodEnd}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("detail.organization")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {plan.organization?.nameVi ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("detail.document")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {plan.document?.documentNumber ?? "—"}
              </span>
            </div>
            {plan.document && (
              <p className="text-xs text-muted-foreground mt-1">
                {plan.document._count.sections} {t("detail.totalSections")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("detail.stats")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm">
              <span>{plan._count.children} {t("detail.childPlans")}</span>
              <span>{plan._count.reports} {t("detail.reports")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      {plan.document ? (
        <Tabs defaultValue="sections" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sections" className="gap-1">
              <FileText className="h-4 w-4" />
              {t("tabs.sections")}
            </TabsTrigger>
            <TabsTrigger value="targets" className="gap-1">
              <Target className="h-4 w-4" />
              {t("tabs.targets")}
            </TabsTrigger>
            <TabsTrigger value="appendices" className="gap-1">
              <TableIcon className="h-4 w-4" />
              {t("tabs.appendices")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sections">
            <SectionsTab
              planId={plan.id}
              documentId={plan.document.id}
              sections={plan.document.sections as SectionNode[]}
            />
          </TabsContent>

          <TabsContent value="targets">
            <TargetsTab planId={plan.id} />
          </TabsContent>

          <TabsContent value="appendices">
            <AppendicesTab
              planId={plan.id}
              appendices={plan.document.appendices as AppendixNode[]}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("detail.noDocument")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Sections Tab ──────────────────────────────────────── */

function SectionsTab({
  planId,
  documentId,
  sections,
}: {
  planId: string;
  documentId: string;
  sections: SectionNode[];
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        {sections.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Không có mục nào
          </p>
        ) : (
          <div className="space-y-1">
            {sections.map((section) => (
              <SectionItem
                key={section.id}
                section={section}
                planId={planId}
                documentId={documentId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionItem({
  section,
  planId,
  documentId,
}: {
  section: SectionNode;
  planId: string;
  documentId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<SectionNode[]>(
    section.children ?? []
  );
  const [targets, setTargets] = useState<TargetNode[]>(
    section.targets ?? []
  );
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(section.loaded ?? false);

  const hasChildren = section._count.children > 0;
  const hasTargets = section._count.targets > 0;
  const expandable = hasChildren || hasTargets;

  const handleToggle = useCallback(async () => {
    if (!expandable) return;

    if (!loaded && !loading) {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/plans/${planId}/sections?parentId=${section.id}&documentId=${documentId}`
        );
        const data = await res.json();
        setChildren(data.children ?? []);
        setTargets(data.targets ?? []);
        setLoaded(true);
      } catch (err) {
        console.error("Failed to load section children:", err);
      } finally {
        setLoading(false);
      }
    }

    setExpanded((prev) => !prev);
  }, [expandable, loaded, loading, planId, section.id, documentId]);

  return (
    <div className={LEVEL_INDENT[section.level] ?? "ml-0"}>
      <div
        className={`flex items-start gap-2 py-2 px-2 rounded-md hover:bg-muted/50 ${
          expandable ? "cursor-pointer" : ""
        }`}
        onClick={handleToggle}
      >
        {expandable ? (
          loading ? (
            <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
          ) : expanded ? (
            <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm shrink-0">
              {section.sectionNumber}
            </span>
            {section.titleVi && (
              <span className="text-sm font-semibold truncate">
                {section.titleVi}
              </span>
            )}
            {hasTargets && (
              <Badge variant="outline" className="text-xs shrink-0">
                {section._count.targets} chỉ tiêu
              </Badge>
            )}
          </div>
          {section.contentVi && !expanded && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {section.contentVi}
            </p>
          )}
          {section.contentVi && expanded && (
            <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
              {section.contentVi}
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ml-2 border-l pl-2">
          {/* Targets for this section */}
          {targets.length > 0 && (
            <div className="ml-4 my-2 space-y-1">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/30"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 ${
                      TARGET_TYPE_COLORS[target.targetType] ?? ""
                    }`}
                  >
                    {target.targetType === "QUANTITATIVE"
                      ? "ĐL"
                      : target.targetType === "QUALITATIVE"
                      ? "ĐT"
                      : "MC"}
                  </Badge>
                  <span className="flex-1 min-w-0 truncate">
                    {target.nameVi}
                  </span>
                  {target.targetValue != null && (
                    <span className="font-mono text-muted-foreground shrink-0">
                      {target.targetValue}
                      {target.unit ? ` ${target.unit}` : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Child sections */}
          {children.map((child) => (
            <SectionItem
              key={child.id}
              section={child}
              planId={planId}
              documentId={documentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Targets Tab ──────────────────────────────────────── */

function TargetsTab({ planId }: { planId: string }) {
  const t = useTranslations("plans");
  const [targets, setTargets] = useState<AllTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/plans/${planId}/sections?all=true`)
      .then((r) => r.json())
      .then((data) => {
        setTargets(data.targets ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [planId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("detail.loading")}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("tabs.targets")} ({targets.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t("targets.name")}</TableHead>
              <TableHead>{t("targets.type")}</TableHead>
              <TableHead>{t("targets.value")}</TableHead>
              <TableHead>{t("targets.section")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                  {t("detail.noTargets")}
                </TableCell>
              </TableRow>
            ) : (
              targets.map((target, idx) => (
                <TableRow key={target.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <span className="line-clamp-2 text-sm">{target.nameVi}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={TARGET_TYPE_COLORS[target.targetType] ?? ""}
                    >
                      {target.targetType === "QUANTITATIVE"
                        ? "Định lượng"
                        : target.targetType === "QUALITATIVE"
                        ? "Định tính"
                        : "Mốc"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {target.targetValue != null ? (
                      <span className="font-mono">
                        {target.targetValue}
                        {target.unit ? ` ${target.unit}` : ""}
                      </span>
                    ) : target.rawTextVi ? (
                      <span className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                        {target.rawTextVi}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {target.section.sectionNumber}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─── Appendices Tab ──────────────────────────────────── */

function AppendicesTab({
  planId,
  appendices,
}: {
  planId: string;
  appendices: AppendixNode[];
}) {
  const t = useTranslations("plans");

  if (appendices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t("detail.noAppendices")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {appendices.map((appendix) => (
        <AppendixCard key={appendix.id} planId={planId} appendix={appendix} />
      ))}
    </div>
  );
}

function AppendixCard({
  planId,
  appendix,
}: {
  planId: string;
  appendix: AppendixNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<AppendixRowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!loaded && !loading) {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/plans/${planId}/appendix/${appendix.id}`
        );
        const data = await res.json();
        setRows(data.rows ?? []);
        setLoaded(true);
      } catch (err) {
        console.error("Failed to load appendix rows:", err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  }, [loaded, loading, planId, appendix.id]);

  // Get column keys from first row
  const columns = rows.length > 0
    ? Object.keys(rows[0].data).filter((k) => k !== "id" && k !== "_raw")
    : [];

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle className="text-base">{appendix.titleVi}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{appendix.appendixType}</Badge>
            <Badge variant="secondary">{appendix._count.rows} hàng</Badge>
          </div>
        </div>
      </CardHeader>

      {expanded && loaded && (
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Không có dữ liệu
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.rowNumber}
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-sm max-w-[300px]">
                          <span className="line-clamp-3">
                            {String(row.data[col] ?? "—")}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
