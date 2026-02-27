import { notFound } from "next/navigation";
import { getReportById } from "@/lib/queries/reports";
import { serialize } from "@/lib/serialize";
import { ReportDetail } from "@/components/reports/report-detail";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();
  return <ReportDetail report={serialize(report)} />;
}
