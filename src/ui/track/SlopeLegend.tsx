import { PACE_GRADIENT } from "./paceColor";
import { SLOPE_BUCKETS } from "./slopeColor";

/**
 * « La couleur ne peut jamais porter seule une information » — les seuils de
 * `slopeColor` en texte, ou, quand l'allure a pris la couleur du cadre, ses
 * deux extrêmes en toutes lettres de part et d'autre de la rampe. Jamais les
 * deux : une seule échelle de couleur à la fois.
 */
export function SlopeLegend({ pace }: { pace: boolean }) {
  if (pace) {
    return (
      <div className="flex shrink-0 items-center justify-center gap-1.5 px-1 text-[9px] text-ink-soft">
        plus lente
        <span
          className="h-1.5 w-20 rounded-full"
          style={{ backgroundImage: PACE_GRADIENT }}
          aria-hidden="true"
        />
        plus rapide
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5 px-1">
      {SLOPE_BUCKETS.map((bucket) => (
        <span
          key={bucket.label}
          className="flex items-center gap-1 text-[9px] text-ink-soft"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: bucket.color }}
            aria-hidden="true"
          />
          {bucket.label}
        </span>
      ))}
    </div>
  );
}
