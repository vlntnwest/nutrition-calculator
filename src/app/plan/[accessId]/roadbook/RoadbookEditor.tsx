"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { imposeOnLegs, saveEditedRoadbook } from "@/app/plans/actions";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { LegOverride } from "@/app/plans/planInput";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import type { ProfilePoint } from "@/core/type";
import { duree } from "@/format/number";
import { Button } from "@/ui/Button";
import { ErrorNote, Notice } from "@/ui/Notice";
import { LegCard } from "./LegCard";
import { LegProfile } from "./LegProfile";
import { PackSummary } from "./PackSummary";
import { warningText } from "./warnings";

/** Le plan affiché, ramené à ce qui se retouche. */
function editOf(roadbook: Roadbook): RoadbookEdit {
  return {
    servings: roadbook.legs.map((leg) =>
      leg.servings.map((s) => ({
        productSnapshotId: s.productSnapshotId,
        quantity: s.quantity,
      })),
    ),
    // Hors de l'ouverture d'une portée, il n'y a pas de contrôle : ne rien
    // recopier là évite de renvoyer un remplissage que le noyau refuserait.
    fills: roadbook.legs.map((leg) =>
      leg.opensLiquidSpan
        ? leg.fills.map((f) => ({
            flaskRank: f.flaskRank,
            productSnapshotId: f.productSnapshotId,
            volumeMl: f.volumeMl,
          }))
        : [],
    ),
  };
}

/** Les consignes actuelles, telles que le serveur les relira. */
function overridesOf(roadbook: Roadbook): LegOverride[] {
  return roadbook.legs.flatMap((leg) => {
    if (leg.imposedDurationS === null && leg.imposedCarbsGH === null) return [];

    return [
      {
        endPositionM: leg.endPositionM ?? roadbook.totalM,
        ...(leg.imposedDurationS === null
          ? {}
          : { durationS: leg.imposedDurationS }),
        ...(leg.imposedCarbsGH === null
          ? {}
          : { targets: { carbsGH: leg.imposedCarbsGH } }),
      },
    ];
  });
}

export function RoadbookEditor({
  accessId,
  roadbook,
  points,
  cibleGH,
}: {
  accessId: string;
  roadbook: Roadbook;
  points: ProfilePoint[];
  /** La cible du plan, celle qui vaut pour un secteur sans consigne. */
  cibleGH: number;
}) {
  const router = useRouter();
  const [rendu, setRendu] = useState(roadbook);
  const [edit, setEdit] = useState(() => editOf(roadbook));
  const [sale, setSale] = useState(false);
  const [actif, setActif] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [imposing, startImpose] = useTransition();

  // `router.refresh()` ne remonte pas le composant. Sans ce retour à la
  // source, un recalcul rafraîchirait les agrégats en laissant les contrôles
  // sur des retouches que le serveur vient de jeter — et l'enregistrement
  // suivant les réimposerait, la confirmation de `Calculer` pour rien.
  if (rendu !== roadbook) {
    setRendu(roadbook);
    setEdit(editOf(roadbook));
    setSale(false);
    setErreur(null);
  }

  /** Pose une quantité sur un secteur. À zéro, la ration disparaît. */
  function setServing(leg: number, snapshotId: string, quantity: number) {
    setSale(true);
    setEdit((e) => ({
      ...e,
      servings: e.servings.map((rations, l) => {
        if (l !== leg) return rations;
        const reste = rations.filter((r) => r.productSnapshotId !== snapshotId);

        return quantity > 0
          ? [...reste, { productSnapshotId: snapshotId, quantity }]
          : reste;
      }),
    }));
  }

  /** Verse, ou vide, une flasque sur un secteur. */
  function setFill(
    leg: number,
    flaskRank: number,
    contenu: { productSnapshotId: string | null; volumeMl: number } | null,
  ) {
    setSale(true);
    setEdit((e) => ({
      ...e,
      fills: e.fills.map((remplissages, l) => {
        if (l !== leg) return remplissages;
        const reste = remplissages.filter((f) => f.flaskRank !== flaskRank);

        return contenu === null ? reste : [...reste, { flaskRank, ...contenu }];
      }),
    }));
  }

  function save() {
    setErreur(null);
    start(async () => {
      const result = await saveEditedRoadbook(accessId, edit);
      if (result.ok) {
        setSale(false);
        // Comme Calculer : c'est le rendu du serveur qu'il faut refaire.
        router.refresh();
      } else {
        setErreur(result.error);
      }
    });
  }

  /**
   * Poser ou retirer une consigne sur un secteur. Le découpage change, donc
   * le calcul repart : l'action serveur fait les deux d'un coup.
   */
  function imposer(rank: number, patch: Partial<LegOverride>) {
    const leg = roadbook.legs.find((l) => l.rank === rank);
    if (!leg) return;

    const borne = leg.endPositionM ?? roadbook.totalM;
    const autres = overridesOf(roadbook).filter(
      (o) => o.endPositionM !== borne,
    );
    const courante = overridesOf(roadbook).find(
      (o) => o.endPositionM === borne,
    );
    const suite: LegOverride = {
      endPositionM: borne,
      durationS: courante?.durationS,
      targets: courante?.targets,
      ...patch,
    };
    const vide = suite.durationS === undefined && suite.targets === undefined;

    setErreur(null);
    startImpose(async () => {
      const result = await imposeOnLegs(
        accessId,
        vide ? autres : [...autres, suite],
      );
      if (result.ok) router.refresh();
      else setErreur(result.error);
    });
  }

  // Les chiffres agrégés viennent du serveur : tant qu'on n'a pas enregistré,
  // ils décrivent l'état d'avant. On les estompe plutôt que de les resommer
  // ici, ce serait rouvrir la divergence que getRoadbook évite. ADR 011.
  const vieux = sale ? "opacity-50" : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 shrink-0 border-line border-b bg-paper">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <LegProfile
            points={points}
            legs={roadbook.legs}
            totalM={roadbook.totalM}
            actif={actif}
            onChoisir={(rank) => {
              setActif(rank);
              document
                .getElementById(`secteur-${rank}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {roadbook.warnings.length > 0 && (
            <div className={`flex flex-col gap-2 ${vieux}`}>
              {roadbook.warnings.map((w) => (
                <Notice key={w.code} code={w.code}>
                  {warningText(w.code, w.payload)}
                </Notice>
              ))}
            </div>
          )}

          {roadbook.legs.map((leg, l) => (
            <LegCard
              key={leg.rank}
              leg={leg}
              rations={edit.servings[l]}
              remplissages={edit.fills[l]}
              roadbook={roadbook}
              cibleGH={leg.imposedCarbsGH ?? cibleGH}
              totalM={roadbook.totalM}
              vieux={vieux}
              imposing={imposing}
              onServing={(id, quantity) => setServing(l, id, quantity)}
              onFill={(rank, contenu) => setFill(l, rank, contenu)}
              onImposerDuree={(durationS) =>
                imposer(leg.rank, { durationS: durationS ?? undefined })
              }
              onImposerCible={(carbsGH) =>
                imposer(leg.rank, {
                  targets: carbsGH === null ? undefined : { carbsGH },
                })
              }
            />
          ))}

          <PackSummary total={roadbook.total} />

          {erreur && <ErrorNote>{erreur}</ErrorNote>}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 shrink-0 border-line border-t bg-paper">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <p className="hidden min-w-0 flex-1 text-[12px] text-ink-soft sm:block">
            {sale
              ? "Les chiffres datent du dernier enregistrement, ils se mettront à jour."
              : `${roadbook.legs.length} secteurs, ${duree(roadbook.legs.reduce((t, l) => t + l.durationS, 0))} de mouvement`}
          </p>
          <Button
            ton="encre"
            disabled={!sale || pending}
            onClick={save}
            className="ml-auto"
          >
            {pending ? "Enregistrement" : "Enregistrer les retouches"}
          </Button>
        </div>
      </div>
    </div>
  );
}
