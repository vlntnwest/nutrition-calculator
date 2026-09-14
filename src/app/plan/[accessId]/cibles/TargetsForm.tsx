"use client";

import { useState } from "react";
import type { Flask, Targets } from "@/core/type";
import { duree, entier, toNumber } from "@/format/number";
import { MeasureField } from "@/ui/Field";
import { Val } from "@/ui/Measure";
import { ErrorNote } from "@/ui/Notice";
import { Panel, Rule } from "@/ui/Panel";
import { SaveBar } from "@/ui/SaveBar";
import { usePlanSave } from "../save";
import { FlaskTable, useFlaskRows, volumesLisibles } from "./FlaskTable";
import { synthetiser } from "./synthese";
import { TargetsPanel } from "./TargetsPanel";

const DEFAUT: Targets = { carbsGH: 60, fluidMlH: 500, sodiumMgL: 600 };

export function TargetsForm({
  accessId,
  targets,
  suggestion,
  flasks,
  massKg,
  targetTimeS,
}: {
  accessId: string;
  targets: Targets | undefined;
  /** Nul tant qu'on ignore le poids ou le chrono. */
  suggestion: Targets | null;
  flasks: Flask[];
  massKg: number | undefined;
  targetTimeS: number | undefined;
}) {
  const [cibles, setCibles] = useState<Targets>(
    targets ?? suggestion ?? DEFAUT,
  );
  const [masse, setMasse] = useState(String(massKg ?? ""));
  const [lignes, setLignes] = useFlaskRows(flasks);
  const [modifie, setModifie] = useState(false);
  const [reproche, setReproche] = useState<string | null>(null);
  const { pending, erreur, enregistre, save, reprise } = usePlanSave(accessId);

  /** Toute saisie annule la confirmation précédente et rouvre le bouton. */
  function change(fait: () => void) {
    fait();
    setModifie(true);
    setReproche(null);
    reprise();
  }

  // Ce qui est montré n'a pas encore été validé : tant que rien n'est
  // enregistré, ce sont les valeurs du noyau, pas celles du coureur.
  const propose = targets === undefined;
  const synthese = targetTimeS
    ? synthetiser(cibles, volumesLisibles(lignes), targetTimeS)
    : null;

  function submit() {
    const kg = toNumber(masse);
    if (kg === undefined || kg <= 0) {
      setReproche("Indiquez le poids du coureur : la suggestion en dépend.");

      return;
    }

    const volumes: Flask[] = [];
    for (const ligne of lignes) {
      const volumeMl = toNumber(ligne.volumeMl);
      if (volumeMl === undefined || volumeMl <= 0) {
        setReproche(
          "Indiquez la contenance de chaque flasque, en millilitres.",
        );

        return;
      }
      volumes.push({ volumeMl, onlyWater: ligne.onlyWater });
    }

    setReproche(null);
    save({ settings: { massKg: kg, targets: cibles }, flasks: volumes }, () =>
      setModifie(false),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div>
              <h2 className="font-semibold text-[22px] text-ink tracking-tight">
                Cibles horaires
              </h2>
              <p className="mt-1 text-[14px] text-ink-soft leading-relaxed">
                {suggestion && propose ? (
                  <>
                    Suggérées d'après <Val unite="kg">{massKg}</Val> et{" "}
                    <Val>{duree(targetTimeS ?? 0)}</Val>. Modifiez-les si vous
                    savez mieux.
                  </>
                ) : (
                  "Ce qu'on vise par heure de course. Le roadbook répartit ensuite ces cibles secteur par secteur."
                )}
              </p>
            </div>

            {/* Le poids ouvre l'écran : c'est de lui que la suggestion
                descend, et le sodium se lit juste après ce dont il dépend.
                Il se tape, quand les trois cibles se choisissent — un poids
                n'a pas de crans. */}
            <Panel className="p-4">
              <MeasureField
                label="Poids du coureur"
                unite="kg"
                value={masse}
                placeholder="70"
                largeur="w-40"
                onChange={(event) => {
                  const saisie = event.target.value;

                  change(() => {
                    setMasse(saisie);
                    // Le débit de boisson suit le poids : 7 mL/kg/h, au cran
                    // de 50 mL le plus proche. Retaper le poids remet donc à
                    // jour la cible, même après une première sauvegarde.
                    const kg = toNumber(saisie);
                    if (kg !== undefined && kg > 0) {
                      setCibles((c) => ({
                        ...c,
                        fluidMlH: Math.round((7 * kg) / 50) * 50,
                      }));
                    }
                  });
                }}
                hint="La suggestion de boisson et la dépense en dépendent."
              />
            </Panel>

            <TargetsPanel
              cibles={cibles}
              onChange={(suite) => change(() => setCibles(suite))}
            />

            <FlaskTable
              lignes={lignes}
              onChange={(suite) => change(() => setLignes(suite))}
            />
          </div>

          {synthese && (
            <aside className="lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
              <Panel className="p-4">
                <h3 className="font-medium text-[13px] text-ink">
                  Ce que ces cibles demandent
                </h3>
                <Rule className="my-3" />
                <p className="text-[14px] text-ink leading-relaxed">
                  Sur {duree(targetTimeS ?? 0)} de course,{" "}
                  <Val unite="g">{entier(synthese.carbsG)}</Val> de glucides et{" "}
                  <Val unite="mL">{entier(synthese.fluidMl)}</Val> de boisson.
                </p>
                <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
                  {synthese.remplissages === null ? (
                    "Aucune flasque déclarée : le calcul ne saura pas où verser la boisson."
                  ) : synthese.remplissages === 0 ? (
                    <>
                      Les <Val unite="mL">{entier(synthese.carryMl)}</Val>{" "}
                      emportés couvrent la distance sans remplissage.
                    </>
                  ) : (
                    <>
                      Les <Val unite="mL">{entier(synthese.carryMl)}</Val>{" "}
                      emportés demandent{" "}
                      {synthese.remplissages === 1
                        ? "un remplissage"
                        : `${synthese.remplissages} remplissages`}{" "}
                      en course.
                    </>
                  )}
                </p>
              </Panel>
            </aside>
          )}
        </div>
      </div>

      {/* `paper-dim` fait de ce pied un plateau creux, pas une bande
          blanche posée sur le papier : le bouton s'y pose, il n'y flotte
          plus seul. Même creux que `Panel ton="creux"`. */}
      <div className="shrink-0 border-line border-t bg-paper-dim">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
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
      </div>
    </div>
  );
}
