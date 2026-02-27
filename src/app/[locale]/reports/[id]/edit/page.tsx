import { notFound } from "next/navigation";
import { getReportById } from "@/lib/queries/reports";
import { serialize } from "@/lib/serialize";
import { EditReportForm } from "@/components/reports/edit-report-form";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function EditReportPage({ params }: Props) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();
  return <EditReportForm report={serialize(report)} />;
}
