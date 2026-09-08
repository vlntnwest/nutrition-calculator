"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { imposeOnLegs, saveEditedRoadbook } from "@/app/plans/actions";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { LegOverride } from "@/app/plans/planInput";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import type { ProfilePoint } from "@/core/type";
import { duree } from "@/format/number";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Toast } from "@/ui/Toast";
import { withFill, withServing } from "./edit";
import { liveTotal, SOLIDE, spanFluidNeedMl, spanStart } from "./format";
import { LegCard } from "./LegCard";
import { LegProfile } from "./LegProfile";
import { PackSummary } from "./PackSummary";
import { warningText } from "./warnings";

/** Ce qui reste de trace au-dessus d'une carte amenée sous le profil. */
const MARGE_SAUT = 12;

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
  entete,
}: {
  accessId: string;
  roadbook: Roadbook;
  points: ProfilePoint[];
  /** La cible du plan, celle qui vaut pour un secteur sans consigne. */
  cibleGH: number;
  /** Le titre, le bouton Calculer et le départ : ils défilent avec la liste
   * plutôt que de rester fixes, pour rendre au pouce la place qu'ils
   * prenaient en haut de l'écran. */
  entete: ReactNode;
}) {
  const router = useRouter();
  const [rendu, setRendu] = useState(roadbook);
  const [edit, setEdit] = useState(() => editOf(roadbook));
  const [sale, setSale] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [imposing, startImpose] = useTransition();
  const defilement = useRef<HTMLDivElement>(null);
  const collant = useRef<HTMLDivElement>(null);

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

  /** Pose une quantité sur un secteur — voir `withServing`. */
  function setServing(leg: number, snapshotId: string, quantity: number) {
    setSale(true);
    setEdit((e) =>
      withServing(
        e,
        roadbook.legs,
        roadbook.catalogue,
        roadbook.flasks,
        leg,
        snapshotId,
        quantity,
      ),
    );
  }

  /** Verse, ou vide, une flasque — voir `withFill`. */
  function setFill(
    leg: number,
    flaskRank: number,
    contenu: { productSnapshotId: string | null; volumeMl: number } | null,
  ) {
    setSale(true);
    setEdit((e) =>
      withFill(e, roadbook.legs, roadbook.catalogue, leg, flaskRank, contenu),
    );
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

  /**
   * La portée où tombe un secteur, telle que sa carte la lit : le rang de
   * celui qui l'ouvre, ce qu'il y a à boire dessus, et les flasques qui la
   * portent — toutes au secteur d'ouverture, seul à en déclarer.
   */
  function porteeDe(l: number) {
    const ouverture = spanStart(roadbook.legs, l);

    return {
      ...ouvertureDe(ouverture),
      // Depuis l'ouverture, pas depuis `l` : la portée est la même vue de
      // n'importe lequel de ses secteurs.
      besoinMl: spanFluidNeedMl(roadbook.legs, ouverture),
      remplissages: edit.fills[ouverture],
    };
  }

  /**
   * Où se prend la nourriture d'un secteur : au dernier ravito qui en donnait.
   * Le solide n'a pas de contenant qui le borne — on dit d'où il sort, on ne
   * déplace pas la ration.
   */
  function priseSolideDe(l: number) {
    return ouvertureDe(spanStart(roadbook.legs, l, SOLIDE));
  }

  /**
   * Le secteur qui ouvre une portée, et le ravito où l'on s'y charge : celui
   * qui **clôt le secteur d'avant**, puisqu'on charge en repartant. Nul au
   * premier secteur, où l'on part de chez soi.
   */
  function ouvertureDe(ouverture: number) {
    return {
      rank: roadbook.legs[ouverture].rank,
      ravito: ouverture === 0 ? null : roadbook.legs[ouverture - 1].endName,
    };
  }

  // Les avertissements viennent du serveur et ne rejouent pas ici — seule la
  // règle qui les déclenche compte, pas leur texte — donc tant qu'on n'a pas
  // enregistré, ils décrivent l'état d'avant. On les estompe plutôt que de
  // les refaire, ce serait rouvrir la divergence que getRoadbook évite (ADR
  // 011). L'apport en glucides, lui, se resomme en direct dans `LegCard` et
  // `PackSummary` : c'est une simple somme des retouches, pas un calcul du
  // noyau, et rien n'y diverge.
  /**
   * Amène la carte d'un secteur sous le profil, et non dessous.
   *
   * `scrollIntoView` cale le haut de la carte sur celui de la zone défilante,
   * c'est-à-dire derrière le profil qui y est collé — la carte arrivait
   * masquée. La hauteur du collant change avec la largeur de l'écran et le
   * relevé qu'il porte : on la mesure au saut plutôt que de la figer en
   * `scroll-margin`.
   */
  function versSecteur(rank: number) {
    const boite = defilement.current;
    const cible = document.getElementById(`secteur-${rank}`);
    if (!boite || !cible) return;

    const haut =
      cible.getBoundingClientRect().top -
      boite.getBoundingClientRect().top +
      boite.scrollTop -
      (collant.current?.offsetHeight ?? 0);

    boite.scrollTo({ top: haut - MARGE_SAUT, behavior: "smooth" });
  }

  const vieux = sale ? "opacity-50" : "";
  const total = liveTotal(
    edit.servings,
    roadbook.legs.map((leg) => leg.needG),
    roadbook.catalogue,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* L'en-tête et la date de départ défilent avec le reste : sur un
          petit écran, ils ne doivent pas retenir en permanence la place que
          les secteurs réclament. Le profil, lui, garde son collant une fois
          qu'on a défilé jusqu'à lui. */}
      <div
        ref={defilement}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {entete}

        <div
          ref={collant}
          className="sticky top-0 z-10 border-line border-b bg-veil backdrop-blur-xl"
        >
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <LegProfile
              points={points}
              legs={roadbook.legs}
              totalM={roadbook.totalM}
              onChoisir={versSecteur}
            />
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6">
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
                index={l}
                rations={edit.servings[l]}
                remplissages={edit.fills[l]}
                roadbook={roadbook}
                cibleGH={leg.imposedCarbsGH ?? cibleGH}
                portee={porteeDe(l)}
                priseSolide={priseSolideDe(l)}
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

            <PackSummary total={total} />
          </div>
        </div>
      </div>

      {erreur && <Toast onFermer={() => setErreur(null)}>{erreur}</Toast>}

      <div className="sticky bottom-0 z-10 shrink-0 border-line border-t bg-paper">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <p className="hidden min-w-0 flex-1 text-[12px] text-ink-soft sm:block">
            {sale
              ? "Les avertissements affichés datent du dernier enregistrement."
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
