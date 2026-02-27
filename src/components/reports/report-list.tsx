"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus, FileText, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import type { ReportListItem } from "@/lib/queries/reports";

type Report = Serialized<ReportListItem>;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  RETURNED: "bg-red-100 text-red-700",
};

interface ReportListProps {
  initialReports: Report[];
}

export function ReportList({ initialReports }: ReportListProps) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return initialReports.filter((r) => {
      const matchesSearch =
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.plan?.nameVi.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesType = typeFilter === "all" || r.reportType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [initialReports, search, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <Button asChild>
          <Link href={`/${locale}/reports/new`}>
            <Plus className="h-4 w-4 mr-2" />
            {t("newReport")}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder") ?? "Tìm kiếm..."}
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
                <SelectItem value="SUBMITTED">{t("status.SUBMITTED")}</SelectItem>
                <SelectItem value="UNDER_REVIEW">{t("status.UNDER_REVIEW")}</SelectItem>
                <SelectItem value="APPROVED">{t("status.APPROVED")}</SelectItem>
                <SelectItem value="RETURNED">{t("status.RETURNED")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t("allTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="PERIODIC_5Y">{t("periodic")}</SelectItem>
                <SelectItem value="AD_HOC">{t("adHoc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">{t("reportTitle")}</TableHead>
              <TableHead>{t("plan")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{tc("status")}</TableHead>
              <TableHead className="text-right">{t("evaluationItems")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {t("noReports")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((report) => (
                <TableRow key={report.id} className="group">
                  <TableCell>
                    <Link
                      href={`/${locale}/reports/${report.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="line-clamp-2">{report.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                    <span className="line-clamp-1">{report.plan?.nameVi ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {report.reportType === "PERIODIC_5Y" ? t("periodic") : t("adHoc")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_COLORS[report.status] ?? ""}>
                      {t(`status.${report.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {report._count?.items ?? 0}
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
