"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Search, FileText, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Serialized } from "@/lib/serialize";
import type { PlanListItem } from "@/lib/queries/plans";

type Plan = Serialized<PlanListItem>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const LEVEL_COLORS: Record<string, string> = {
  NATIONAL: "bg-red-100 text-red-700",
  REGIONAL: "bg-purple-100 text-purple-700",
  PROVINCE: "bg-indigo-100 text-indigo-700",
  SECTOR: "bg-teal-100 text-teal-700",
};

interface PlanListProps {
  initialPlans: Plan[];
}

export function PlanList({ initialPlans }: PlanListProps) {
  const t = useTranslations("plans");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const filtered = useMemo(() => {
    return initialPlans.filter((plan) => {
      const matchesSearch =
        !search ||
        plan.nameVi.toLowerCase().includes(search.toLowerCase()) ||
        (plan.nameEn?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (plan.document?.documentNumber?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "all" || plan.status === statusFilter;

      const matchesLevel =
        levelFilter === "all" || plan.planType?.level === levelFilter;

      return matchesSearch && matchesStatus && matchesLevel;
    });
  }, [initialPlans, search, statusFilter, levelFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t("allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="DRAFT">{t("status.DRAFT")}</SelectItem>
                <SelectItem value="APPROVED">{t("status.APPROVED")}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t("status.IN_PROGRESS")}</SelectItem>
                <SelectItem value="COMPLETED">{t("status.COMPLETED")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t("allLevels")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allLevels")}</SelectItem>
                <SelectItem value="NATIONAL">{t("level.NATIONAL")}</SelectItem>
                <SelectItem value="REGIONAL">{t("level.REGIONAL")}</SelectItem>
                <SelectItem value="PROVINCE">{t("level.PROVINCE")}</SelectItem>
                <SelectItem value="SECTOR">{t("level.SECTOR")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t("resultCount", { count: filtered.length })}
      </p>

      {/* Plan Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">{t("table.name")}</TableHead>
              <TableHead>{t("table.type")}</TableHead>
              <TableHead>{t("table.period")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.sections")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((plan) => (
                <TableRow key={plan.id} className="group">
                  <TableCell>
                    <Link
                      href={`/${locale}/plans/${plan.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="line-clamp-2">{plan.nameVi}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                    {plan.document?.documentNumber && (
                      <span className="text-xs text-muted-foreground ml-6">
                        {plan.document.documentNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {plan.planType && (
                      <Badge variant="outline" className={LEVEL_COLORS[plan.planType.level] ?? ""}>
                        {plan.planType.nameVi}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {plan.periodStart}–{plan.periodEnd}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_COLORS[plan.status] ?? ""}>
                      {t(`status.${plan.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {plan.document?._count?.sections ?? 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
