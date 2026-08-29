import { planOf, roadbookOf } from "../plan";
import { Calculer } from "./Calculer";
import { Retoucher } from "./Retoucher";

/** Écran 5 — le calcul, et ce qu'il donne. */
export default async function Page(
  props: PageProps<"/plan/[accessId]/roadbook">,
) {
  const { accessId } = await props.params;
  const [plan, roadbook] = await Promise.all([
    planOf(accessId),
    roadbookOf(accessId),
  ]);
  if (!plan) return null;

  return (
    <section className="flex flex-col gap-6">
      <Calculer accessId={accessId} calcule={roadbook !== null} />

      {roadbook === null ? (
        <p>
          Ce plan n'a pas encore été calculé. Il lui faut au moins un chrono et
          un poids.
        </p>
      ) : (
        <Retoucher
          accessId={accessId}
          roadbook={roadbook}
          totalM={plan.track.distanceM}
        />
      )}
    </section>
  );
}
