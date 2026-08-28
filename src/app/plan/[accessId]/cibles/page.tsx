import { suggestedTargets } from "@/core/nutrition";
import { planOf } from "../plan";
import { CiblesForm } from "./CiblesForm";

/**
 * Écran 3 — combien manger et boire par heure, et dans quoi.
 *
 * Sans réponse encore donnée, on montre ce que le noyau suggère plutôt
 * qu'une constante : elle tient compte du coureur et de la durée.
 */
export default async function Page(
  props: PageProps<"/plan/[accessId]/cibles">,
) {
  const { accessId } = await props.params;
  const plan = await planOf(accessId);
  if (!plan) return null;

  const { massKg, targetTimeS, targets } = plan.settings;
  const suggestion =
    massKg === undefined || targetTimeS === undefined
      ? null
      : suggestedTargets({ massKg, flasks: [] }, targetTimeS);

  return (
    <CiblesForm
      accessId={accessId}
      targets={targets}
      suggestion={suggestion}
      flasks={plan.flasks}
    />
  );
}
