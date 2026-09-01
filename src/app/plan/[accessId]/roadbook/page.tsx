import { planOf, roadbookOf } from "../plan";
import { ComputeButton } from "./ComputeButton";
import { RoadbookEditor } from "./RoadbookEditor";

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
      <ComputeButton
        accessId={accessId}
        calcule={roadbook !== null}
        edited={roadbook?.edited ?? false}
      />

      {roadbook === null ? (
        <p>
          Ce plan n'a pas encore été calculé. Il lui faut au moins un chrono et
          un poids.
        </p>
      ) : (
        <RoadbookEditor
          accessId={accessId}
          roadbook={roadbook}
          totalM={plan.track.distanceM}
        />
      )}
    </section>
  );
}
