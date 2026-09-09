"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { NewPlan } from "@/app/plans/planInput";
import { type HMS, paceLabel, toHMS, toSecondsHMS } from "@/format/clock";
import { duree, toNumber } from "@/format/number";
import { Button } from "@/ui/Button";
import { ChronoInput } from "@/ui/Chrono";
import { ChevronIcon, PlusIcon } from "@/ui/icons";
import { Val } from "@/ui/Measure";
import { EmptyNote, ErrorNote } from "@/ui/Notice";
import { Panel, PanelHead, Rule } from "@/ui/Panel";
import { SaveBar } from "@/ui/SaveBar";
import { Slider } from "@/ui/Slider";
import { ElevationChart } from "@/ui/track/ElevationChart";
import type { Reserves } from "@/ui/track/RouteMap";
import { usePlanSave } from "../save";
import { AidStationCard } from "./AidStationCard";
import { paceAxisRange, paceBand, paceSegments } from "./pacing";
import {
  insererTriee,
  kmTexte,
  pointIndexAt,
  type Row,
  rangees,
  survivingOverrides,
  toRow,
  toStations,
} from "./stations";

// Leaflet lit `window` dès son import : un module client-only, jamais rendu
// côté serveur pour l'hydratation.
const RouteMap = dynamic(() => import("@/ui/track/RouteMap"), { ssr: false });

/**
 * Écran Course : la trace occupe le cadre, le papier porte l'écriture. Sur
 * grand écran les deux se partagent la largeur et le profil prend toute la
 * largeur en socle ; au pouce la trace passe derrière, le papier monte du
 * bas, réductible d'un geste, et le profil reste une carte du papier.
 *
 * Un ravito se pose au clic, sur le profil ou sur la carte, puis se règle
 * dans sa carte. Une seule carte reste ouverte à la fois : la colonne garde
 * sa hauteur, et poser un point replie le précédent.
 */
export function RaceScreen({
  accessId,
  plan,
}: {
  accessId: string;
  plan: NewPlan;
}) {
  const [chrono, setChrono] = useState<HMS>(toHMS(plan.settings.targetTimeS));
  const [climb, setClimb] = useState(plan.settings.climbEffort ?? 0);
  const [split, setSplit] = useState(plan.settings.paceSplit ?? 0);
  const [lignes, setLignes] = useState<Row[]>(plan.aidStations.map(toRow));
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [depliee, setDepliee] = useState(false);
  /** Le rang d'une borne à amener sous les yeux, le temps d'un rendu. */
  const [vise, setVise] = useState<number | null>(null);
  const [modifie, setModifie] = useState(false);
  const [reproche, setReproche] = useState<string | null>(null);
  const { pending, erreur, enregistre, save, reprise } = usePlanSave(accessId);

  const totalM = plan.track.distanceM;
  const points = plan.track.points;
  const profile = plan.track.profile;

  // Le découpage ne dépend que du relief : il survit à tous les réglages
  // d'allure, et ne se refait pas quand un curseur bouge.
  const segments = useMemo(() => paceSegments(profile), [profile]);

  useEffect(() => {
    if (vise === null) return;

    document
      .getElementById(`ravito-${vise}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setVise(null);
  }, [vise]);

  function change(fait: () => void) {
    fait();
    setModifie(true);
    setReproche(null);
    reprise();
  }

  /**
   * Poser une borne : elle prend son rang sur la trace, s'ouvre aussitôt, et
   * la précédente se replie.
   */
  function poser(positionM: number) {
    change(() => {
      const { lignes: suite, rang } = insererTriee(lignes, positionM);
      setLignes(suite);
      setOuverte(rang - 1);
    });
  }

  /**
   * Ouvrir la carte d'une borne visée sur le profil ou sur la carte.
   *
   * Au pouce, la feuille se déplie d'abord : la carte demandée tombe sinon
   * sous le bord de l'écran, et l'on aurait cliqué pour rien.
   *
   * Le rang visé passe par un état plutôt que par un défilement immédiat :
   * la carte s'ouvre et la feuille grandit dans le même rendu, et viser la
   * position d'avant ne bougeait presque pas la colonne. L'effet ci-dessous
   * défile une fois la mise en page faite, puis oublie le rang — sans quoi
   * replier la carte à la main ferait défiler à nouveau.
   */
  function ouvrir(rang: number) {
    setOuverte(rang - 1);
    setDepliee(true);
    setVise(rang);
  }

  /**
   * Glisse une borne le long du profil : sa position suit le doigt, et la
   * colonne se range derrière elle comme à la frappe dans sa carte — voir
   * `rangees`. Pas de `setVise` ici : `ouvrir` a déjà amené la carte sous les
   * yeux au premier contact, la faire défiler à chaque frame giflerait la
   * colonne.
   */
  function deplacer(rang: number, positionM: number) {
    const cible = lignes[rang - 1];
    if (!cible) return;

    change(() => {
      const suite = rangees(
        lignes.map((l) =>
          l.id === cible.id ? { ...l, km: kmTexte(positionM) } : l,
        ),
      );
      setLignes(suite);
      setOuverte(suite.findIndex((l) => l.id === cible.id));
    });
  }

  // Les bornes lisibles alimentent à la fois le profil et la carte : une
  // position encore à moitié tapée n'a pas à faire disparaître les autres.
  const bornes = useMemo(
    () =>
      lignes.flatMap((ligne, i) => {
        const valeur = toNumber(ligne.km);

        return valeur === undefined
          ? []
          : [
              {
                rank: i + 1,
                positionM: valeur * 1000,
                libelle:
                  ligne.name.trim() === ""
                    ? `Ravito ${i + 1}`
                    : ligne.name.trim(),
              },
            ];
      }),
    [lignes],
  );

  const marqueurs = useMemo(
    () =>
      bornes.map((borne) => ({
        rank: borne.rank,
        index: pointIndexAt(points, borne.positionM),
      })),
    [bornes, points],
  );

  // La hauteur de la feuille repliée, en dur ici comme en classe plus bas :
  // c'est la même décision de mise en page, et la carte doit la connaître en
  // pixels pour cadrer la trace au-dessus.
  const FEUILLE_REPLIEE = 0.46;
  /** La largeur de la colonne de papier à partir de `lg`, `w-[27rem]`. */
  const COLONNE_LG = 432;

  // Ce que l'interface pose par-dessus la carte, pour que le recadrage vise
  // le vide plutôt que le cadre entier : la feuille montante au pouce, la
  // colonne de saisie sur grand écran. Le socle du profil, lui, est déjà
  // hors de la carte — elle s'arrête à `lg:bottom-72`.
  const [large, setLarge] = useState<boolean | null>(null);

  useEffect(() => {
    const requete = window.matchMedia("(min-width: 1024px)");
    const suivre = () => setLarge(requete.matches);

    suivre();
    requete.addEventListener("change", suivre);

    return () => requete.removeEventListener("change", suivre);
  }, []);

  const reserves = useMemo(
    (): Reserves =>
      large === null
        ? {}
        : large
          ? { left: COLONNE_LG }
          : {
              bottom: Math.round(window.innerHeight * FEUILLE_REPLIEE),
            },
    [large],
  );

  const targetTimeS = toSecondsHMS(chrono);
  const arretsS = lignes.reduce(
    (total, ligne) => total + (toNumber(ligne.stopMin) ?? 0) * 60,
    0,
  );
  // ADR 010 : les arrêts se retranchent du chrono visé, donc l'allure de
  // mouvement est plus rapide que le chrono divisé par la distance.
  const mouvementS =
    targetTimeS === undefined ? undefined : Math.max(targetTimeS - arretsS, 0);
  const allure = paceLabel(mouvementS, totalM);
  // L'allure par tronçon, refaite à chaque frappe du chrono et à chaque
  // déplacement d'un curseur : c'est le seul endroit du produit où l'on voit
  // ce que ces trois réglages font au parcours, avant de l'enregistrer.
  const bande = useMemo(
    () =>
      paceBand(profile, segments, mouvementS, {
        climbEffort: climb,
        split,
      }),
    [profile, segments, mouvementS, climb, split],
  );
  // Bornée sur ce que les curseurs peuvent produire, jamais sur leur
  // position du moment : voir `paceAxisRange`.
  const axeAllure = useMemo(
    () => paceAxisRange(profile, segments, mouvementS),
    [profile, segments, mouvementS],
  );

  function submit() {
    const stations = toStations(lignes, totalM);
    if (typeof stations === "string") {
      setReproche(stations);

      return;
    }

    setReproche(null);
    save(
      {
        settings: {
          targetTimeS,
          climbEffort: climb,
          paceSplit: split,
        },
        aidStations: stations,
        legOverrides: survivingOverrides(plan.legOverrides, stations, totalM),
      },
      () => setModifie(false),
    );
  }

  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col lg:pb-72">
      {/* La trace occupe tout le cadre, la colonne de papier flotte dessus.
          `isolate` est indispensable : Leaflet empile ses panneaux à
          z-index 400 et ils passeraient sinon devant le papier. */}
      <div className="-z-10 absolute inset-0 isolate lg:bottom-72">
        <RouteMap
          points={points}
          hoverIndex={hoverIndex}
          onHoverIndex={setHoverIndex}
          stations={marqueurs}
          onPick={(index) => poser(points[index]?.d ?? 0)}
          onChoisirStation={ouvrir}
          reserves={reserves}
          deplacable
        />
      </div>

      <section
        className={`absolute inset-x-0 bottom-0 z-10 flex max-h-full flex-col rounded-t-[var(--radius-sheet)] border border-line border-b-0 bg-white transition-[height] duration-300 ease-out lg:static lg:bg-transparent lg:h-auto lg:min-h-0 lg:w-[27rem] lg:flex-1 lg:rounded-none lg:border-t-0 lg:border-r-0 lg:border-b-0 lg:border-l-0 ${
          depliee ? "h-[74dvh]" : "h-[46dvh]"
        }`}
      >
        <button
          type="button"
          onClick={() => setDepliee(!depliee)}
          aria-expanded={depliee}
          className="flex cursor-pointer items-center justify-center gap-2 py-2 text-[12px] text-ink-soft lg:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-line-strong" />
          <ChevronIcon
            className={`size-4 transition-transform ${depliee ? "" : "rotate-180"}`}
          />
          <span className="sr-only">
            {depliee ? "Réduire la feuille" : "Déplier la feuille"}
          </span>
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-transparent scrollbar-none px-4 pb-4 lg:pt-5">
          <Panel>
            <PanelHead titre="Chrono visé" />
            <Rule />
            <div className="flex flex-col gap-2.5 p-4">
              <ChronoInput
                value={chrono}
                onChange={(value) => change(() => setChrono(value))}
              />
              <p className="text-[12px] text-ink-soft leading-relaxed">
                {allure ? (
                  <>
                    soit <Val unite="/km">{allure}</Val> en mouvement
                    {arretsS > 0 && (
                      <>
                        , les <Val>{duree(arretsS)}</Val> d'arrêt déduits
                      </>
                    )}
                  </>
                ) : (
                  "un chrono est nécessaire pour calculer le plan"
                )}
              </p>

              <div className={`flex-col gap-5 p-4 flex`}>
                <Slider
                  label="Effort en montée"
                  value={climb}
                  min={-0.4}
                  max={0.4}
                  step={0.05}
                  bornes={["moins d'effort", "plus d'effort"]}
                  onChange={(value) => change(() => setClimb(value))}
                />
                <Slider
                  label="Dérive d'allure"
                  value={split}
                  min={-0.2}
                  max={0.2}
                  step={0.01}
                  bornes={["négatif", "positif"]}
                  onChange={(value) => change(() => setSplit(value))}
                />
              </div>
            </div>
          </Panel>

          {/* Sur grand écran le profil quitte la colonne : posé en absolu
              sur l'écran, il échappe au défilement de la feuille et devient
              le socle pleine largeur que la réserve `lg:pb-72` lui garde. */}
          <Panel className="lg:absolute lg:inset-x-0 lg:bottom-0 lg:flex lg:h-72 lg:flex-col lg:rounded-none lg:border-x-0 lg:border-b-0">
            <PanelHead titre="Profil et allure">
              {allure && (
                <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-soft">
                  moyenne <Val unite="/km">{allure}</Val>
                </span>
              )}
            </PanelHead>
            <Rule className="lg:shrink-0" />
            <div className="h-72 lg:h-auto lg:min-h-0 lg:flex-1">
              <ElevationChart
                points={points}
                hoverIndex={hoverIndex}
                onHoverIndex={setHoverIndex}
                marks={bornes}
                onPick={poser}
                onChoisirMark={ouvrir}
                onDeplacerMark={deplacer}
                paceBand={bande}
                paceAxisRange={axeAllure}
              />
            </div>
          </Panel>

          <div className="flex flex-col gap-2.5">
            {/* <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-medium text-[13px] text-ink">
                Ravitaillements
              </h2>
              <span className="font-mono text-[11px] text-ink-soft">
                {lignes.length === 0
                  ? "aucun posé"
                  : `${lignes.length} posé${lignes.length > 1 ? "s" : ""}`}
              </span>
            </div> */}

            {lignes.length === 0 ? (
              <EmptyNote titre="Aucune borne sur la trace">
                La course se découpe aux ravitos.
              </EmptyNote>
            ) : (
              lignes.map((ligne, i) => (
                <AidStationCard
                  key={ligne.id}
                  rang={i + 1}
                  ligne={ligne}
                  ouverte={ouverte === i}
                  onOuvrir={() => setOuverte(ouverte === i ? null : i)}
                  onChange={(patch) =>
                    change(() => {
                      // Retoucher la position doit ranger la borne à sa place,
                      // pas la laisser à son rang de saisie : voir `rangees`.
                      const suite = rangees(
                        lignes.map((l) =>
                          l.id === ligne.id ? { ...l, ...patch } : l,
                        ),
                      );
                      setLignes(suite);
                      setOuverte(suite.findIndex((l) => l.id === ligne.id));
                    })
                  }
                  onRetirer={() =>
                    change(() => {
                      setLignes(lignes.filter((l) => l.id !== ligne.id));
                      setOuverte(null);
                    })
                  }
                />
              ))
            )}

            <Button
              icone={<PlusIcon className="size-4" />}
              className="self-start w-full"
              onClick={() => poser(totalM / 2)}
            >
              Ajouter un ravito
            </Button>
          </div>

          {/* <p className="flex items-start gap-2 text-[11px] text-ink-faint leading-relaxed">
            <PinIcon className="mt-px size-3.5 shrink-0" />
            <span>
              Le départ et l'arrivée bornent déjà la course. Il faut {km(1000)}{" "}
              km au moins entre deux bornes, sur les{" "}
              <Val unite="km">{km(totalM)}</Val> et {entier(plan.track.ascentM)}{" "}
              m de dénivelé de cette trace.
            </span>
          </p> */}

          {reproche && <ErrorNote>{reproche}</ErrorNote>}
          {erreur && <ErrorNote>{erreur}</ErrorNote>}
          <SaveBar
            pending={pending}
            modifie={modifie}
            enregistre={enregistre && !modifie}
            consequence="le roadbook devra être recalculé"
            onSave={submit}
          />
        </div>
      </section>
    </div>
  );
}
