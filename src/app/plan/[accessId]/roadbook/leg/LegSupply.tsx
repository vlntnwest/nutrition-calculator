import type { Roadbook } from "@/app/plans/roadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { ecart, entier } from "@/format/number";
import { Releve, Val } from "@/ui/Measure";
import { excessive, liveCarriedMl, liveSupply } from "../format";
import type { Portee } from "./portee";

/**
 * Ce que le secteur apporte, et l'écart à ce qu'il demande.
 *
 * Recalculé sur les retouches en cours : `leg.supply` date du dernier
 * enregistrement, et doubler une gaufre doit se voir tout de suite plutôt
 * que d'attendre la sauvegarde pour savoir où l'on en est.
 */
export function LegSupply({
  leg,
  rations,
  remplissages,
  catalogue,
  portee,
}: {
  leg: Roadbook["legs"][number];
  rations: RoadbookEdit["servings"][number];
  remplissages: RoadbookEdit["fills"][number];
  catalogue: Roadbook["catalogue"];
  portee: Portee;
}) {
  const supply = liveSupply(rations, catalogue);
  const trop = excessive(supply.carbsG, leg.needG);
  // Le liquide emporté à l'ouverture de la portée : le volume des flasques,
  // eau claire ou boisson confondues. Voir `liveCarriedMl`.
  const porte = liveCarriedMl(remplissages);
  // Quand un ravito ne donne pas d'eau, la portée déborde du secteur et
  // l'écart ne se lit plus contre le besoin de cette carte-ci : il le dit.
  // L'égalité est exacte, `spanFluidNeedMl` rendant la valeur elle-même
  // quand la portée tient en un secteur.
  const surLaPortee = portee.besoinMl !== leg.needFluidMl;

  return (
    <div className="border-line border-b bg-paper-dim px-4 py-3">
      <p className="text-[14px] text-ink">
        Apport <Val>{entier(supply.carbsG)}</Val> g de glucides{" "}
        {ecart(supply.carbsG - leg.needG) !== "" && (
          <span className={trop ? "font-medium text-accent" : "text-ink-soft"}>
            ({ecart(supply.carbsG - leg.needG)}
            {trop ? ", au-dessus du besoin" : ""})
          </span>
        )}
      </p>
      <Releve
        className="mt-0.5"
        items={[
          <>
            <Val>{entier(supply.sodiumMg)}</Val> mg de sodium
            {ecart(supply.sodiumMg - leg.needSodiumMg, "mg", 5) && (
              <span className="text-ink-faint">
                {" "}
                ({ecart(supply.sodiumMg - leg.needSodiumMg, "mg", 5)})
              </span>
            )}
          </>,
          // Un secteur qui ouvre une portée annonce ce qu'il emporte, comme
          // les glucides et le sodium juste au-dessus annoncent leur apport.
          // Ailleurs, il n'y a rien à emporter : le besoin seul, sans écart.
          leg.opensLiquidSpan ? (
            <>
              liquide <Val>{entier(porte)}</Val> mL
              {ecart(porte - portee.besoinMl, "mL", 5) && (
                <span className="text-ink-faint">
                  {" "}
                  ({ecart(porte - portee.besoinMl, "mL", 5)}
                  {surLaPortee ? " sur la portée" : ""})
                </span>
              )}
            </>
          ) : (
            <>
              à boire <Val>{entier(leg.needFluidMl)}</Val> mL
            </>
          ),
        ]}
      />
    </div>
  );
}
