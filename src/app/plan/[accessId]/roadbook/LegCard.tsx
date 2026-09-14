"use client";

import type { Roadbook } from "@/app/plans/roadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { Notice } from "@/ui/Notice";
import { Rule } from "@/ui/Panel";
import { legBounds } from "./format";
import { LegFlasks } from "./leg/LegFlasks";
import { LegHeader } from "./leg/LegHeader";
import { LegImpositions } from "./leg/LegImpositions";
import { LegServings } from "./leg/LegServings";
import { LegSupply } from "./leg/LegSupply";
import type { Portee, PriseSolide } from "./leg/portee";
import { warningText } from "./warnings";

/**
 * Un secteur du roadbook. Il se lit de haut en bas comme une consigne de
 * course : où il s'arrête, combien de temps il dure, ce qu'on y prend, ce que
 * cela donne, et ce qui cloche.
 */
export function LegCard({
  leg,
  index,
  rations,
  remplissages,
  roadbook,
  cibleGH,
  portee,
  priseSolide,
  totalM,
  vieux,
  onServing,
  onFill,
  onImposerDuree,
  onImposerCible,
  imposing,
}: {
  leg: Roadbook["legs"][number];
  /** Son rang dans `roadbook.legs`, pour en lire les bornes et l'amont. */
  index: number;
  rations: RoadbookEdit["servings"][number];
  remplissages: RoadbookEdit["fills"][number];
  roadbook: Roadbook;
  /** La cible horaire qui s'applique ici, imposée ou héritée du plan. */
  cibleGH: number;
  portee: Portee;
  priseSolide: PriseSolide;
  totalM: number;
  /** Les avertissements datent du dernier enregistrement. */
  vieux: string;
  onServing: (snapshotId: string, quantity: number) => void;
  onFill: (
    flaskRank: number,
    contenu: { productSnapshotId: string | null; volumeMl: number } | null,
  ) => void;
  onImposerDuree: (durationS: number | null) => void;
  onImposerCible: (carbsGH: number | null) => void;
  imposing: boolean;
}) {
  const bornes = legBounds(roadbook.legs, index);
  const nom = `${bornes.depart} → ${bornes.arrivee}`;

  return (
    <article
      id={`secteur-${leg.rank}`}
      className="scroll-mt-4 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper"
    >
      <LegHeader
        leg={leg}
        index={index}
        legs={roadbook.legs}
        startTime={roadbook.startTime}
        totalM={totalM}
      />

      <LegImpositions
        leg={leg}
        cibleGH={cibleGH}
        imposing={imposing}
        onImposerDuree={onImposerDuree}
        onImposerCible={onImposerCible}
      />

      <Rule />

      <LegSupply
        leg={leg}
        rations={rations}
        remplissages={remplissages}
        catalogue={roadbook.catalogue}
        portee={portee}
      />

      <LegServings
        leg={leg}
        rations={rations}
        catalogue={roadbook.catalogue}
        flasks={roadbook.flasks}
        portee={portee}
        priseSolide={priseSolide}
        nom={nom}
        onServing={onServing}
      />

      <LegFlasks
        leg={leg}
        rations={rations}
        remplissages={remplissages}
        catalogue={roadbook.catalogue}
        flasks={roadbook.flasks}
        portee={portee}
        nom={nom}
        vieux={vieux}
        onFill={onFill}
      />

      {leg.warnings.length > 0 && (
        <div className={`flex flex-col gap-2 px-4 pb-3 ${vieux}`}>
          {leg.warnings.map((w) => (
            <Notice key={w.code}>{warningText(w.code, w.payload)}</Notice>
          ))}
        </div>
      )}
    </article>
  );
}
