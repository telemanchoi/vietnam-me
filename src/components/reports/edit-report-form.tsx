"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormRenderer, hasStructuredForm } from "@/components/evaluation/forms/form-renderer";
import type { Serialized } from "@/lib/serialize";
import type { ReportDetail } from "@/lib/queries/reports";

type Report = Serialized<ReportDetail>;

interface ItemUpdate {
  id: string;
  templateId: string;
  content: string;
}

export function EditReportForm({ report }: { report: Report }) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const router = useRouter();

  const [title, setTitle] = useState(report.title);
  const [periodStart, setPeriodStart] = useState(
    report.periodStart.split("T")[0]
  );
  const [periodEnd, setPeriodEnd] = useState(
    report.periodEnd.split("T")[0]
  );
  const [itemContents, setItemContents] = useState<Record<string, string>>(
    () => {
      const map: Record<string, string> = {};
      report.items.forEach((item) => {
        map[item.id] = item.content || "";
      });
      return map;
    }
  );
  const [saving, setSaving] = useState(false);

  const handleItemChange = useCallback((itemId: string, content: string) => {
    setItemContents((prev) => ({ ...prev, [itemId]: content }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const items: ItemUpdate[] = report.items.map((item) => ({
        id: item.id,
        templateId: item.template.id,
        content: itemContents[item.id] || "",
      }));

      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          periodStart,
          periodEnd,
          items,
        }),
      });

      if (!res.ok) throw new Error("Failed to update report");

      toast.success(t("saveSuccess"));
      router.push(`/${locale}/reports/${report.id}`);
    } catch (err) {
      console.error(err);
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/reports/${report.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("editReport")}</h1>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reportTitle")}</CardTitle>
          <CardDescription>
            {report.plan?.nameVi} ({report.plan?.periodStart}–{report.plan?.periodEnd})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("reportTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("periodStart")}</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("periodEnd")}</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Items */}
      <Separator />
      <h2 className="text-lg font-semibold">{t("evaluationItems")}</h2>

      {report.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.template.itemCode}</Badge>
              <CardTitle className="text-base">{item.template.titleVi}</CardTitle>
            </div>
            {item.template.descriptionVi && (
              <CardDescription className="whitespace-pre-wrap">
                {item.template.descriptionVi}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {hasStructuredForm(item.template.itemCode) ? (
              <FormRenderer
                itemCode={item.template.itemCode}
                value={itemContents[item.id] || "{}"}
                onChange={(val) => handleItemChange(item.id, val)}
                readOnly={false}
              />
            ) : (
              <Textarea
                placeholder={t("itemPlaceholder")}
                value={itemContents[item.id] || ""}
                onChange={(e) => handleItemChange(item.id, e.target.value)}
                rows={4}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/${locale}/reports/${report.id}`}>
            {t("cancel") ?? "Hủy"}
          </Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t("save") ?? "Lưu"}
        </Button>
      </div>
    </div>
  );
}
