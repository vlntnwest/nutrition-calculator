import type { Roadbook } from "@/app/plans/getRoadbook";
import { planOf, roadbookOf } from "../plan";
import { Calculer } from "./Calculer";

/** `-12.4` → `−12`, `+3.2` → `+3`. Signé : l'écart peut être négatif. */
function ecart(marginG: number): string {
  if (Math.abs(marginG) < 1) return "";
  const signe = marginG > 0 ? "+" : "−";

  return ` (${signe}${Math.round(Math.abs(marginG))} g)`;
}

/** `4556` → `1 h 15`. */
function duree(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);

  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")}`;
}

function borne(leg: Roadbook["legs"][number], totalM: number): string {
  return leg.endPositionM === null
    ? `arrivée (${(totalM / 1000).toFixed(1)} km)`
    : `${(leg.endPositionM / 1000).toFixed(1)} km`;
}

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
        <>
          {roadbook.warnings.length > 0 && (
            <ul className="flex flex-col gap-1" role="alert">
              {roadbook.warnings.map((w) => (
                <li key={w.code}>⚠ {w.code}</li>
              ))}
            </ul>
          )}

          <ol className="flex flex-col gap-4">
            {roadbook.legs.map((leg) => (
              <li key={leg.rank} className="flex flex-col gap-1 border-t pt-2">
                <h3 className="font-semibold">
                  Secteur {leg.rank} — jusqu'à{" "}
                  {borne(leg, plan.track.distanceM)}
                </h3>
                <p className="text-sm">
                  {duree(leg.durationS)} · +{leg.ascentM} m / −{leg.descentM} m
                </p>

                {leg.servings.length > 0 && (
                  <ul className="text-sm">
                    {leg.servings.map((s) => (
                      <li key={s.name}>
                        {s.quantity} × {s.brandName} {s.name}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-sm">
                  Apport : {Math.round(leg.supply.carbsG)} g de glucides
                  {ecart(leg.marginG)} ·{" "}
                  {Math.round(leg.supply.energyKcal).toLocaleString("fr")} kcal
                  · {Math.round(leg.supply.sodiumMg)} mg de sodium ·{" "}
                  {Math.round(leg.supply.fluidMl)} mL de boisson
                </p>

                <p className="text-sm">
                  À boire : {Math.round(leg.needFluidMl)} mL
                </p>

                {leg.fills.length > 0 && (
                  <ul className="text-sm">
                    {leg.fills.map((f) => (
                      <li key={f.flaskRank}>
                        Flasque {f.flaskRank} pleine — {f.volumeMl} mL
                        {f.product === null ? " d'eau" : ` de ${f.product}`}
                      </li>
                    ))}
                  </ul>
                )}

                {leg.warnings.map((w) => (
                  <p key={w.code} className="text-sm">
                    ⚠ {w.code}
                  </p>
                ))}
              </li>
            ))}
          </ol>

          <section className="flex flex-col gap-1 border-t pt-2">
            <h3 className="font-semibold">Le sac complet</h3>
            <ul className="text-sm">
              {roadbook.total.units.map((u) => (
                <li key={u.name}>
                  {u.quantity} × {u.brandName} {u.name}
                </li>
              ))}
            </ul>
            <p className="text-sm">
              {Math.round(roadbook.total.carbsG)} g de glucides
              {ecart(roadbook.total.marginG)} ·{" "}
              {Math.round(roadbook.total.energyKcal).toLocaleString("fr")} kcal
              · {Math.round(roadbook.total.sodiumMg)} mg de sodium ·{" "}
              {Math.round(roadbook.total.fluidMl)} mL de boisson
            </p>
          </section>
        </>
      )}
    </section>
  );
}
