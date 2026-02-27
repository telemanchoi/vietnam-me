"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FormRenderer, hasStructuredForm } from "@/components/evaluation/forms/form-renderer";
import type { Serialized } from "@/lib/serialize";

interface PlanOption {
  id: string;
  nameVi: string;
  periodStart: number;
  periodEnd: number;
  organizationId: string;
  organization: { id: string; nameVi: string } | null;
}

interface Template {
  id: string;
  evaluationType: string;
  itemCode: string;
  titleVi: string;
  titleEn: string | null;
  descriptionVi: string | null;
  descriptionEn: string | null;
  sortOrder: number;
}

interface ItemData {
  templateId: string;
  content: string;
  sortOrder: number;
}

interface NewReportFormProps {
  plans: Serialized<PlanOption[]>;
  initialTemplates: Serialized<Template[]>;
}

export function NewReportForm({ plans, initialTemplates }: NewReportFormProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const router = useRouter();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [reportType, setReportType] = useState("PERIODIC_5Y");
  const [title, setTitle] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [templates, setTemplates] = useState<Serialized<Template[]>>(initialTemplates);
  const [itemContents, setItemContents] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Load templates when type changes
  useEffect(() => {
    fetch(`/api/evaluations/templates?type=${reportType}`)
      .then((r) => r.json())
      .then(setTemplates)
      .catch(console.error);
  }, [reportType]);

  // Auto-fill period from plan
  useEffect(() => {
    if (selectedPlan) {
      setPeriodStart(`${selectedPlan.periodStart}-01-01`);
      setPeriodEnd(`${selectedPlan.periodEnd}-12-31`);
      if (!title) {
        setTitle(
          `Báo cáo đánh giá ${reportType === "PERIODIC_5Y" ? "định kỳ" : "đột xuất"} - ${selectedPlan.nameVi.substring(0, 80)}`
        );
      }
    }
  }, [selectedPlan, reportType]);

  const handleItemChange = useCallback(
    (templateId: string, content: string) => {
      setItemContents((prev) => ({ ...prev, [templateId]: content }));
    },
    []
  );

  const handleSave = async () => {
    if (!selectedPlanId || !title || !periodStart || !periodEnd) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setSaving(true);
    try {
      const items: ItemData[] = templates.map((tpl, idx) => ({
        templateId: tpl.id,
        content: itemContents[tpl.id] || "",
        sortOrder: idx,
      }));

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          reportType,
          title,
          periodStart,
          periodEnd,
          organizationId: selectedPlan?.organizationId ?? selectedPlan?.organization?.id,
          items,
        }),
      });

      if (!res.ok) throw new Error("Failed to create report");

      const report = await res.json();
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
          <Link href={`/${locale}/reports`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("newReport")}</h1>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reportTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("selectPlan")}</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPlan")} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <span className="line-clamp-1">
                        {plan.nameVi} ({plan.periodStart}–{plan.periodEnd})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("selectType")}</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERIODIC_5Y">{t("periodic")}</SelectItem>
                  <SelectItem value="AD_HOC">{t("adHoc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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

          {selectedPlan?.organization && (
            <div className="text-sm text-muted-foreground">
              {t("organization")}: {selectedPlan.organization.nameVi}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluation Items */}
      {selectedPlanId && templates.length > 0 && (
        <>
          <Separator />
          <h2 className="text-lg font-semibold">{t("evaluationItems")}</h2>

          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{tpl.itemCode}</Badge>
                  <CardTitle className="text-base">{tpl.titleVi}</CardTitle>
                </div>
                {tpl.descriptionVi && (
                  <CardDescription className="whitespace-pre-wrap">
                    {tpl.descriptionVi}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {hasStructuredForm(tpl.itemCode) ? (
                  <FormRenderer
                    itemCode={tpl.itemCode}
                    value={itemContents[tpl.id] || "{}"}
                    onChange={(val) => handleItemChange(tpl.id, val)}
                    readOnly={false}
                  />
                ) : (
                  <Textarea
                    placeholder={t("itemPlaceholder")}
                    value={itemContents[tpl.id] || ""}
                    onChange={(e) => handleItemChange(tpl.id, e.target.value)}
                    rows={4}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={`/${locale}/reports`}>{t("cancel") ?? "Hủy"}</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving || !selectedPlanId}>
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
