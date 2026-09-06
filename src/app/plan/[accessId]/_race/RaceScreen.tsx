"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { NewPlan } from "@/app/plans/planInput";
import { type HMS, paceLabel, toHMS, toSecondsHMS } from "@/format/clock";
import { duree, entier, km, toNumber } from "@/format/number";
import { Button } from "@/ui/Button";
import { ChronoInput } from "@/ui/Chrono";
import { FieldLabel } from "@/ui/Field";
import { ChevronIcon, PinIcon, PlusIcon } from "@/ui/icons";
import { Val } from "@/ui/Measure";
import { EmptyNote, ErrorNote } from "@/ui/Notice";
import { Panel, PanelHead, Rule } from "@/ui/Panel";
import { SaveBar } from "@/ui/SaveBar";
import { Slider } from "@/ui/Slider";
import { ElevationChart } from "@/ui/track/ElevationChart";
import { usePlanSave } from "../save";
import { AidStationCard } from "./AidStationCard";
import {
  pointIndexAt,
  type Row,
  rowAt,
  survivingOverrides,
  toRow,
  toStations,
} from "./stations";

// Leaflet lit `window` dès son import : un module client-only, jamais rendu
// côté serveur pour l'hydratation.
const RouteMap = dynamic(() => import("@/ui/track/RouteMap"), { ssr: false });

/**
 * Écran Course : la trace occupe le cadre, le papier porte l'écriture. Sur
 * grand écran les deux se partagent la largeur ; au pouce la trace passe
 * derrière et le papier monte du bas, réductible d'un geste.
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
  const [climb, setClimb] = useState(plan.settings.climbIntensity ?? 0.25);
  const [split, setSplit] = useState(plan.settings.paceSplit ?? 0);
  const [lignes, setLignes] = useState<Row[]>(plan.aidStations.map(toRow));
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [depliee, setDepliee] = useState(false);
  const [allureOuverte, setAllureOuverte] = useState(false);
  const [modifie, setModifie] = useState(false);
  const [reproche, setReproche] = useState<string | null>(null);
  const { pending, erreur, enregistre, save, reprise } = usePlanSave(accessId);

  const totalM = plan.track.distanceM;
  const points = plan.track.points;

  function change(fait: () => void) {
    fait();
    setModifie(true);
    setReproche(null);
    reprise();
  }

  /** Poser une borne : elle s'ouvre aussitôt, la précédente se replie. */
  function poser(positionM: number) {
    change(() => {
      const suite = [...lignes, rowAt(positionM, lignes.length + 1)];
      setLignes(suite);
      setOuverte(suite.length - 1);
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
          : [{ rank: i + 1, positionM: valeur * 1000 }];
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
          climbIntensity: climb,
          paceSplit: split,
        },
        aidStations: stations,
        legOverrides: survivingOverrides(plan.legOverrides, stations, totalM),
      },
      () => setModifie(false),
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* `isolate` : Leaflet empile ses panneaux à z-index 400. Sans contexte
          d'empilement propre, ils passeraient devant la feuille du bas. */}
      <div className="absolute inset-0 isolate z-0 lg:static lg:order-2 lg:flex-1">
        <RouteMap
          points={points}
          hoverIndex={hoverIndex}
          onHoverIndex={setHoverIndex}
          stations={marqueurs}
          onPick={(index) => poser(points[index]?.d ?? 0)}
        />
      </div>

      <section
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[var(--radius-sheet)] border border-line border-b-0 max-h-full bg-paper shadow-[var(--shadow-lifted)] transition-[height] duration-300 ease-out lg:static lg:order-1 lg:h-auto lg:max-h-none lg:w-[27rem] lg:shrink-0 lg:rounded-none lg:border-0 lg:border-r lg:shadow-none ${
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 lg:px-5 lg:pt-5">
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
                    soit <Val>{allure} /km</Val> en mouvement
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
            </div>
          </Panel>

          <Panel>
            <button
              type="button"
              onClick={() => setAllureOuverte(!allureOuverte)}
              aria-expanded={allureOuverte}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[13px] text-ink">
                  Comment ce chrono se répartit
                </span>
                <span className="block font-mono text-[11px] text-ink-faint">
                  montée {climb.toLocaleString("fr-FR")} · dérive{" "}
                  {split.toLocaleString("fr-FR")}
                </span>
              </span>
              <ChevronIcon
                className={`size-4 shrink-0 text-ink-faint transition-transform ${allureOuverte ? "rotate-180" : ""}`}
              />
            </button>
            {allureOuverte && <Rule />}
            <div
              className={`flex-col gap-5 p-4 ${allureOuverte ? "flex" : "hidden"}`}
            >
              <Slider
                label="Effort en montée"
                value={climb}
                min={0}
                max={1}
                step={0.05}
                bornes={["les côtes coûtent cher", "les côtes passent bien"]}
                onChange={(value) => change(() => setClimb(value))}
              />
              <Slider
                label="Dérive d'allure"
                value={split}
                min={-0.2}
                max={0.2}
                step={0.01}
                bornes={["négatif, fin plus rapide", "positif, fin plus lente"]}
                aide={
                  split === 0
                    ? "Allure plate : le même effort du départ à l'arrivée."
                    : `Environ ${Math.round(Math.abs(split) * 100)} % ${split > 0 ? "plus lent" : "plus rapide"} au dernier kilomètre qu'au premier.`
                }
                onChange={(value) => change(() => setSplit(value))}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHead
              titre="Profil"
              aide="Cliquez sur le relief, ou sur la trace, pour poser un ravito."
            />
            <Rule />
            <div className="h-44">
              <ElevationChart
                points={points}
                hoverIndex={hoverIndex}
                onHoverIndex={setHoverIndex}
                marks={bornes}
                onPick={poser}
              />
            </div>
          </Panel>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-medium text-[13px] text-ink">
                Ravitaillements
              </h2>
              <span className="font-mono text-[11px] text-ink-soft">
                {lignes.length === 0
                  ? "aucun posé"
                  : `${lignes.length} posé${lignes.length > 1 ? "s" : ""}`}
              </span>
            </div>

            {lignes.length === 0 ? (
              <EmptyNote titre="Aucune borne sur la trace">
                La course se découpe aux ravitos. Cliquez sur le profil pour en
                poser un, ou ajoutez-le à la main.
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
                    change(() =>
                      setLignes(
                        lignes.map((l, j) =>
                          j === i ? { ...l, ...patch } : l,
                        ),
                      ),
                    )
                  }
                  onRetirer={() =>
                    change(() => {
                      setLignes(lignes.filter((_, j) => j !== i));
                      setOuverte(null);
                    })
                  }
                />
              ))
            )}

            <Button
              taille="sm"
              icone={<PlusIcon className="size-4" />}
              className="self-start"
              onClick={() => poser(totalM / 2)}
            >
              Ajouter un ravito
            </Button>
          </div>

          <p className="flex items-start gap-2 text-[11px] text-ink-faint leading-relaxed">
            <PinIcon className="mt-px size-3.5 shrink-0" />
            <span>
              Le départ et l'arrivée bornent déjà la course. Il faut {km(1000)}{" "}
              km au moins entre deux bornes, sur les <Val>{km(totalM)} km</Val>{" "}
              et {entier(plan.track.ascentM)} m de dénivelé de cette trace.
            </span>
          </p>

          {reproche && <ErrorNote>{reproche}</ErrorNote>}
          {erreur && <ErrorNote>{erreur}</ErrorNote>}
        </div>

        <div className="shrink-0">
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
