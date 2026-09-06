import type { Roadbook } from "@/app/plans/getRoadbook";
import { ecart, entier, quantite } from "@/format/number";
import { nomProduit } from "@/format/produit";
import { Stat } from "@/ui/Measure";
import { Panel, PanelHead, Rule } from "@/ui/Panel";

/**
 * Le sac complet : la somme des secteurs, jamais une saisie. On corrige un
 * secteur, le sac suit. C'est aussi la seule vue qui donne le poids porté au
 * départ.
 */
export function PackSummary({ total }: { total: Roadbook["total"] }) {
  return (
    <Panel ton="creux">
      <PanelHead
        titre="Le sac complet"
        aide="La somme des secteurs. Il ne se modifie pas ici."
      />
      <Rule />

      <ul className="flex flex-col px-4">
        {total.units.length === 0 && (
          <li className="py-3 text-[13px] text-ink-faint">
            Rien dans le sac pour l'instant.
          </li>
        )}
        {total.units.map((unite) => (
          <li
            key={unite.name}
            className="flex items-baseline gap-3 border-line border-b py-2 last:border-b-0"
          >
            <span className="w-12 shrink-0 font-mono text-[14px] text-ink">
              {quantite(unite.quantity)} ×
            </span>
            <span className="min-w-0 flex-1 text-[14px] text-ink">
              {nomProduit(unite.name)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-ink-soft">
              {unite.brandName}
            </span>
          </li>
        ))}
      </ul>

      <Rule className="mt-1" />

      <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-5">
        <Stat
          value={entier(total.carbsG)}
          unite="g"
          label={`glucides${ecart(total.marginG) === "" ? "" : ` (${ecart(total.marginG)})`}`}
        />
        <Stat value={entier(total.energyKcal)} unite="kcal" label="énergie" />
        <Stat value={entier(total.sodiumMg)} unite="mg" label="sodium" />
        <Stat value={entier(total.fluidMl)} unite="mL" label="boisson" />
        <Stat value={entier(total.weightG)} unite="g" label="porté au départ" />
      </div>
    </Panel>
  );
}
