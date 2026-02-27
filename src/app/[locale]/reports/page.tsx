import { getReports } from "@/lib/queries/reports";
import { serialize } from "@/lib/serialize";
import { ReportList } from "@/components/reports/report-list";

export default async function ReportsPage() {
  const reports = await getReports();
  return <ReportList initialReports={serialize(reports)} />;
}
