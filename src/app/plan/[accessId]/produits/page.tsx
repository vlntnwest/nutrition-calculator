import { listProducts } from "@/app/plans/catalogue";
import { planOf } from "../plan";
import { ProduitsForm } from "./ProduitsForm";

/** Écran 4 — ce qu'on emporte. Le noyau répartit, on ne choisit pas par secteur. */
export default async function Page(
  props: PageProps<"/plan/[accessId]/produits">,
) {
  const { accessId } = await props.params;
  const [plan, catalogue] = await Promise.all([
    planOf(accessId),
    listProducts(),
  ]);
  if (!plan) return null;

  return (
    <ProduitsForm
      accessId={accessId}
      catalogue={catalogue}
      choisis={plan.productCodes}
    />
  );
}
