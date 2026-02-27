import { getPlans } from "@/lib/queries/plans";
import { serialize } from "@/lib/serialize";
import { PlanList } from "@/components/plans/plan-list";

export default async function PlansPage() {
  const plans = await getPlans();
  return <PlanList initialPlans={serialize(plans)} />;
}
