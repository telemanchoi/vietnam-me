import { notFound } from "next/navigation";
import { getPlanById } from "@/lib/queries/plans";
import { serialize } from "@/lib/serialize";
import { PlanDetail } from "@/components/plans/plan-detail";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function PlanDetailPage({ params }: Props) {
  const { id } = await params;
  const plan = await getPlanById(id);

  if (!plan) notFound();

  return <PlanDetail plan={serialize(plan)} />;
}
