import { getDashboardStats } from "@/lib/queries/dashboard";
import { serialize } from "@/lib/serialize";
import { getTranslations } from "next-intl/server";
import { FileText, ClipboardList, Target, Building2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportsByStatusChart } from "@/components/dashboard/reports-by-status-chart";
import { RecentReportsList } from "@/components/dashboard/recent-reports-list";
import { KpiTable } from "@/components/dashboard/kpi-table";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const stats = serialize(await getDashboardStats());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("totalPlans")}
          value={stats.totalPlans}
          icon={FileText}
        />
        <StatCard
          title={t("totalReports")}
          value={stats.totalReports}
          icon={ClipboardList}
        />
        <StatCard
          title="Chỉ tiêu"
          value={stats.totalTargets.toLocaleString()}
          icon={Target}
        />
        <StatCard
          title="Cơ quan"
          value={stats.plansByStatus.length > 0 ? `${stats.plansByStatus.length} trạng thái` : "—"}
          icon={Building2}
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReportsByStatusChart
          data={stats.reportsByStatus}
          title={t("reportsByStatus")}
        />
        <RecentReportsList
          reports={stats.recentReports}
          title={t("recentReports")}
          locale={locale}
        />
      </div>

      {/* KPI Table */}
      <KpiTable
        targetStats={stats.targetStats}
        totalTargets={stats.totalTargets}
        title="Phân loại chỉ tiêu"
      />
    </div>
  );
}
