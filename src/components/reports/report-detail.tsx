"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Edit, FileText, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FormRenderer,
  hasStructuredForm,
  isQualitativeFlowItem,
} from "@/components/evaluation/forms/form-renderer";
import { FormPY09to11Qualitative } from "@/components/evaluation/forms/form-py09-11-qualitative";
import type { Serialized } from "@/lib/serialize";
import type { ReportDetail as ReportDetailType } from "@/lib/queries/reports";

type Report = Serialized<ReportDetailType>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  RETURNED: "bg-red-100 text-red-700",
};

export function ReportDetail({ report }: { report: Report }) {
  const t = useTranslations("reports");
  const locale = useLocale();

  // Separate regular items from qualitative flow items (PY-09~11)
  const regularItems = useMemo(
    () =>
      report.items.filter(
        (item) => !isQualitativeFlowItem(item.template.itemCode)
      ),
    [report.items]
  );

  const qualitativeItems = useMemo(
    () =>
      report.items
        .filter((item) => isQualitativeFlowItem(item.template.itemCode))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [report.items]
  );

  // Build qualitative flow items for read-only display
  const qualitativeFlowItems = useMemo(
    () =>
      qualitativeItems.map((item) => ({
        itemCode: item.template.itemCode,
        templateId: item.template.id,
        content: item.content || "",
      })),
    [qualitativeItems]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/reports`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-bold leading-tight">{report.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">
              {report.reportType === "PERIODIC_5Y"
                ? t("periodic")
                : t("adHoc")}
            </Badge>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[report.status] ?? ""}
            >
              {t(`status.${report.status}`)}
            </Badge>
          </div>
        </div>
        {report.status === "DRAFT" && (
          <Button asChild>
            <Link href={`/${locale}/reports/${report.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              {t("editReport")}
            </Link>
          </Button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("plan")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Link
                href={`/${locale}/plans/${report.plan?.id}`}
                className="font-medium hover:underline text-sm line-clamp-2"
              >
                {report.plan?.nameVi ?? "—"}
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("organization")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                {report.organization?.nameVi ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {t("periodStart")} – {t("periodEnd")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                {new Date(report.periodStart).toLocaleDateString()} –{" "}
                {new Date(report.periodEnd).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation Items */}
      <Separator />
      <h2 className="text-lg font-semibold">{t("evaluationItems")}</h2>

      {/* Regular items: PY-01 ~ PY-08 */}
      {regularItems.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.template.itemCode}</Badge>
              <CardTitle className="text-base">
                {item.template.titleVi}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {hasStructuredForm(item.template.itemCode) ? (
              <FormRenderer
                itemCode={item.template.itemCode}
                value={item.content || "{}"}
                readOnly={true}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm">
                {item.content || (
                  <span className="text-muted-foreground italic">
                    Chưa có nội dung
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* PY-09 ~ PY-11: Qualitative flow read-only display */}
      {qualitativeItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">PY-09 ~ PY-11</Badge>
              <CardTitle className="text-base flex-1">
                Đánh giá định tính (Điều 55.9 ~ 55.11)
              </CardTitle>
            </div>
            <CardDescription>
              Khó khăn, vướng mắc — Đề xuất giải pháp — Kiến nghị điều chỉnh
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormPY09to11Qualitative
              items={qualitativeFlowItems}
              onChange={() => {}}
              readOnly={true}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
