import { getPlansForSelect, getTemplates } from "@/lib/queries/reports";
import { serialize } from "@/lib/serialize";
import { NewReportForm } from "@/components/reports/new-report-form";

export default async function NewReportPage() {
  const [plans, templates] = await Promise.all([
    getPlansForSelect(),
    getTemplates("PERIODIC_5Y"),
  ]);
  return (
    <NewReportForm
      plans={serialize(plans)}
      initialTemplates={serialize(templates)}
    />
  );
}
