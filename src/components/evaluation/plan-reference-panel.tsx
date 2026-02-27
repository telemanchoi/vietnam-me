"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Target,
  ListChecks,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */

interface MatchingSection {
  id: string;
  level: string;
  sectionNumber: string;
  titleVi: string | null;
  contentVi: string | null;
  relevanceScore: number;
  matchedKeywords: string[];
}

interface TargetItem {
  id: string;
  targetType: string;
  nameVi: string;
  unit: string | null;
  targetValue: string | number | null;
  targetYear: number | null;
  targetMin: string | number | null;
  targetMax: string | number | null;
}

interface AppendixItem {
  id: string;
  titleVi: string;
  appendixType: string;
  _count: { rows: number };
}

interface MatchingResult {
  sections: MatchingSection[];
  targets?: TargetItem[];
  appendices?: AppendixItem[];
}

interface PlanReferencePanelProps {
  planId: string;
  itemCode: string;
  onClose: () => void;
}

/* ---------- Component ---------- */

export function PlanReferencePanel({
  planId,
  itemCode,
  onClose,
}: PlanReferencePanelProps) {
  const t = useTranslations("evaluation");
  const [data, setData] = useState<MatchingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/evaluations/plan-sections?planId=${planId}&itemCode=${itemCode}`,
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        /* swallow */
      }
      setLoading(false);
    }
    load();
  }, [planId, itemCode]);

  const totalItems =
    (data?.sections.length ?? 0) +
    (data?.targets?.length ?? 0) +
    (data?.appendices?.length ?? 0);

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            {t("relatedPlanContent")}
            {!loading && (
              <Badge variant="outline" className="text-[10px]">
                {totalItems} {t("matchingSections").toLowerCase()}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3 px-4">
        {loading && (
          <p className="text-xs text-muted-foreground py-2">Đang tải...</p>
        )}

        {!loading && totalItems === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            {t("noMatchingSections")}
          </p>
        )}

        {/* Matching sections */}
        {data?.sections && data.sections.length > 0 && (
          <div className="space-y-1 mb-3">
            {data.sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        )}

        {/* Targets (for PY-08: 55.8 목표/지표 달성도) */}
        {data?.targets && data.targets.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
              <Target className="h-3 w-3" />
              Mục tiêu quy hoạch ({data.targets.length})
            </div>
            <div className="space-y-0.5 rounded-md border bg-white p-2">
              {data.targets.slice(0, 15).map((target) => (
                <div key={target.id} className="flex items-baseline gap-2 text-xs py-0.5">
                  <span className="flex-1">{target.nameVi}</span>
                  {target.targetValue != null && (
                    <span className="font-mono text-muted-foreground shrink-0">
                      {String(target.targetValue)}
                      {target.unit ? ` ${target.unit}` : ""}
                    </span>
                  )}
                  {target.targetMin != null && target.targetMax != null && (
                    <span className="font-mono text-muted-foreground shrink-0">
                      {String(target.targetMin)}–{String(target.targetMax)}
                      {target.unit ? ` ${target.unit}` : ""}
                    </span>
                  )}
                </div>
              ))}
              {data.targets.length > 15 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  +{data.targets.length - 15} mục tiêu khác
                </p>
              )}
            </div>
          </div>
        )}

        {/* Appendices (for PY-04: 55.4 주요 프로젝트) */}
        {data?.appendices && data.appendices.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
              <ListChecks className="h-3 w-3" />
              Phụ lục dự án ({data.appendices.length})
            </div>
            <div className="space-y-1">
              {data.appendices.map((appendix) => (
                <div
                  key={appendix.id}
                  className="flex items-center gap-2 text-xs rounded-md border bg-white p-2"
                >
                  <ListChecks className="h-3 w-3 text-blue-500 shrink-0" />
                  <span className="flex-1">{appendix.titleVi}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {appendix._count.rows} dự án
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- SectionCard ---------- */

function SectionCard({ section }: { section: MatchingSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasContent = section.contentVi && section.contentVi.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-md border bg-white">
        <CollapsibleTrigger asChild>
          <button className="flex items-start gap-2 w-full text-left p-2 hover:bg-muted/30">
            {hasContent ? (
              isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    section.level === "DIEU" && "border-blue-300 text-blue-700",
                    section.level === "ROMAN" && "border-gray-300",
                  )}
                >
                  {section.sectionNumber}
                </Badge>
                {section.titleVi && (
                  <span className="text-xs font-medium">{section.titleVi}</span>
                )}
              </div>
              {/* Matched keywords */}
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {section.matchedKeywords.slice(0, 3).map((kw) => (
                  <span
                    key={kw}
                    className="text-[9px] bg-yellow-100 text-yellow-800 px-1 rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {hasContent && (
          <CollapsibleContent>
            <div className="px-3 pb-2 border-t">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 max-h-40 overflow-auto">
                {section.contentVi}
              </p>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
