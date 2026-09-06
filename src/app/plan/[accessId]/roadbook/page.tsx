import Link from "next/link";
import { resolveTargets } from "@/app/plans/targets";
import { duree } from "@/format/number";
import { ArrowRightIcon } from "@/ui/icons";
import { EmptyNote } from "@/ui/Notice";
import { destinations } from "../_shell/destinations";
import { planOf, roadbookOf } from "../plan";
import { CalculeDepuis, ComputeButton } from "./ComputeButton";
import { RoadbookEditor } from "./RoadbookEditor";

/** Écran 7 — le calcul, et ce qu'il donne. */
export default async function Page(
  props: PageProps<"/plan/[accessId]/roadbook">,
) {
  const { accessId } = await props.params;
  const [plan, roadbook] = await Promise.all([
    planOf(accessId),
    roadbookOf(accessId),
  ]);
  if (!plan) return null;

  // La même décision que le calcul : les cibles saisies, ou celles que le
  // noyau suggère. L'écart montré doit porter sur ce qui a été visé.
  const cibles = resolveTargets(
    {
      targetCarbsGH: plan.settings.targets?.carbsGH ?? null,
      targetFluidMlH: plan.settings.targets?.fluidMlH ?? null,
      targetSodiumMgL: plan.settings.targets?.sodiumMgL ?? null,
    },
    { massKg: plan.settings.massKg ?? 70, flasks: plan.flasks },
    plan.settings.targetTimeS ?? 0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-4xl shrink-0 flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold text-[22px] text-ink tracking-tight">
            Roadbook
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {roadbook ? (
              <>
                {duree(plan.settings.targetTimeS ?? 0)}
                <span className="px-1.5 text-ink-faint">·</span>
                {roadbook.legs.length} secteur
                {roadbook.legs.length > 1 ? "s" : ""}
                <span className="px-1.5 text-ink-faint">·</span>
                <CalculeDepuis at={roadbook.generatedAt.toISOString()} />
              </>
            ) : (
              "Ce que le plan devient une fois le temps et la nutrition répartis."
            )}
          </p>
        </div>

        <ComputeButton
          accessId={accessId}
          calcule={roadbook !== null}
          edited={roadbook?.edited ?? false}
        />
      </div>

      {roadbook === null ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          <div className="mx-auto max-w-xl">
            <EmptyNote titre="Ce plan n'a pas encore été calculé">
              Il lui faut un chrono visé, un poids de coureur et au moins un
              produit dans le sac. Le calcul répartit ensuite le temps secteur
              par secteur, puis la nutrition dessus.
            </EmptyNote>

            <ul className="mt-4 flex flex-col gap-2">
              {destinations(plan, false)
                .filter((d) => d.segment !== "roadbook" && d.etat === "vide")
                .map((manquant) => (
                  <li key={manquant.nom}>
                    <Link
                      href={`/plan/${accessId}/${manquant.segment}`}
                      className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2.5 text-[14px] text-ink transition-colors hover:border-line-strong hover:bg-paper-dim"
                    >
                      <span className="flex-1">
                        {manquant.nom}
                        <span className="pl-2 text-[12px] text-ink-soft">
                          {manquant.mention}
                        </span>
                      </span>
                      <ArrowRightIcon className="size-4 text-ink-faint" />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : (
        <RoadbookEditor
          accessId={accessId}
          roadbook={roadbook}
          points={plan.track.points}
          cibleGH={cibles.carbsGH}
        />
      )}
    </div>
  );
}
