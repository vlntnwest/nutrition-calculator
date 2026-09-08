"use client";

import { useState } from "react";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { ProfilePoint } from "@/core/type";
import { paceLabel } from "@/format/clock";
import { km } from "@/format/number";
import { ElevationChart, type Gouttieres } from "@/ui/track/ElevationChart";
import { paceRampColor } from "@/ui/track/paceColor";
import { legBounds, legPaceBand, legPaceSPerKm, startOf } from "./format";

/**
 * Le relief et l'allure, tenus en tête pendant que les secteurs défilent
 * derrière — la même lecture que sur l'écran Course : l'allure se superpose
 * au relief en dégradé, et les pastilles du profil restent cliquables pour
 * amener la carte du secteur sous les yeux — elles portent le nom du ravito
 * qu'elles marquent, que le survol et le lecteur d'écran rendent.
 *
 * À partir de `lg`, une bande reprend le relevé secteur par secteur sous le
 * graphique, chaque bouton large à proportion de sa distance et cliquable
 * comme les pastilles : au pouce, ce texte descend sous la taille lisible et
 * la cible de clic sous la largeur qu'on vise juste (l'ancienne bande posait
 * ce problème sur tout écran) — elle ne se pose donc qu'à partir de la
 * largeur qui la rend fiable, et le dégradé seul répond en dessous.
 */
export function LegProfile({
  points,
  legs,
  totalM,
  onChoisir,
}: {
  points: ProfilePoint[];
  legs: Roadbook["legs"];
  totalM: number;
  onChoisir: (rank: number) => void;
}) {
  const bande = legPaceBand(legs, totalM);
  const [gouttieres, setGouttieres] = useState<Gouttieres | null>(null);
  const allures = legs.map((_, i) => legPaceSPerKm(legs, i, totalM));

  // Tant que le graphique n'a pas mesuré son cadre, la bande reste au bord :
  // une gouttière devinée serait fausse à coup sûr, une gouttière nulle n'est
  // fausse que d'un rendu. Voir `Gouttieres`.
  const calage = {
    paddingLeft: gouttieres?.gauche ?? 0,
    paddingRight: gouttieres?.droite ?? 0,
  };
  const slowestSPerKm = bande?.slowestSPerKm ?? 0;
  const ecart =
    bande && bande.slowestSPerKm > bande.fastestSPerKm
      ? bande.slowestSPerKm - bande.fastestSPerKm
      : 0;

  return (
    <div>
      <div className="h-36 sm:h-44">
        <ElevationChart
          points={points}
          paceBand={bande}
          onCadre={setGouttieres}
          // Le nom du ravito, pas le repli « Ravito {rank} » du composant :
          // il ne tombait juste que tant que les ravitos s'appelaient comme
          // leur rang, et le rang lu ici est celui du secteur qu'ils closent.
          marks={legs.flatMap((leg, i) =>
            leg.endPositionM === null
              ? []
              : [
                  {
                    rank: leg.rank,
                    positionM: leg.endPositionM,
                    libelle: legBounds(legs, i).arrivee,
                  },
                ],
          )}
          onChoisirMark={onChoisir}
        />
      </div>

      {/* Ni retrait horizontal, ni gouttière : un secteur doit mesurer
          exactement la part de trace qu'il décrit, la séparation se dessine
          à l'intérieur de chaque bouton plutôt que de se prendre sur la
          largeur avant le partage proportionnel. */}
      <div className="hidden pb-2 lg:flex" style={calage}>
        {legs.map((leg, i) => {
          const debut = startOf(legs, i);
          const fin = leg.endPositionM ?? totalM;
          const dernier = i === legs.length - 1;
          const allure = allures[i];
          const teinte =
            allure !== null && ecart > 0
              ? paceRampColor((slowestSPerKm - allure) / ecart)
              : "var(--line-strong)";

          return (
            <button
              key={leg.rank}
              type="button"
              onClick={() => onChoisir(leg.rank)}
              style={{ flexGrow: Math.max(fin - debut, 1) }}
              className="flex min-w-0 basis-0 cursor-pointer flex-col items-center gap-0.5 rounded-[4px] py-1.5 text-center transition-colors hover:ring-1 hover:ring-line-strong hover:ring-inset"
            >
              <span
                className={`h-1.5 w-full border-paper ${dernier ? "rounded-r-full" : "border-r"} ${i === 0 ? "rounded-l-full" : ""}`}
                style={{ backgroundColor: teinte }}
              />
              <span className="w-full truncate px-0.5 font-mono text-[10px] text-ink-soft">
                {paceLabel(leg.durationS, fin - debut) ??
                  legBounds(legs, i).arrivee}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="flex items-baseline justify-between gap-4 pb-2 text-[10px] text-ink-faint"
        style={calage}
      >
        <span>départ</span>
        <span>{km(totalM)} km</span>
      </p>
    </div>
  );
}
