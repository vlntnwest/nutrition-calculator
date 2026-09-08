"use client";

import { useState } from "react";
import {
  CARBS_GUIDE_G_H,
  CARBS_SINGLE_SOURCE_MAX_G_H,
  FLUID_GUIDE_ML_H,
} from "@/core/nutrition";
import type { Flask, Targets } from "@/core/type";
import { duree, entier, toNumber } from "@/format/number";
import { Button, IconButton } from "@/ui/Button";
import { ToggleChip } from "@/ui/Chip";
import { Hint, MeasureField } from "@/ui/Field";
import { PlusIcon, TrashIcon } from "@/ui/icons";
import { Val } from "@/ui/Measure";
import { EmptyNote, ErrorNote, Notice } from "@/ui/Notice";
import { Panel, PanelHead, Rule } from "@/ui/Panel";
import { Reglage } from "@/ui/Reglage";
import { SaveBar } from "@/ui/SaveBar";
import { usePlanSave } from "../save";
import { paliersBoisson, paliersGlucides, paliersSodium } from "./paliers";
import { synthetiser } from "./synthese";

/** `id` n'est jamais écrit : il tient l'identité d'une ligne pendant la saisie. */
type FlaskRow = { id: string; volumeMl: string; onlyWater: boolean };

let compteur = 0;

function nouvelId(): string {
  compteur += 1;

  return `flasque-${compteur}`;
}

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
  const [lignes, setLignes] = useState<FlaskRow[]>(
    flasks.map((f) => ({
      id: nouvelId(),
      volumeMl: String(f.volumeMl),
      onlyWater: f.onlyWater,
    })),
  );
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

            <Panel className="p-4">
              {/* Trois réglages indépendants, côte à côte dès que la largeur
                  le permet : chacun se lit d'un regard, sans faire défiler
                  les deux autres pour l'atteindre. `items-start` évite
                  qu'une remarque conditionnelle, plus haute dans une
                  colonne, n'étire les deux autres. */}
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-0 lg:divide-x lg:divide-line">
                <div className="flex flex-col gap-3 lg:flex-1 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                  <Reglage
                    label="Glucides"
                    unite="g/h"
                    value={cibles.carbsGH}
                    crans={paliersGlucides(cibles.carbsGH)}
                    onChange={(carbsGH) =>
                      change(() => setCibles({ ...cibles, carbsGH }))
                    }
                  />
                  {cibles.carbsGH > CARBS_GUIDE_G_H && (
                    <Notice code="carbs-above-guide">
                      Au-delà de <Val unite="g/h">{CARBS_GUIDE_G_H}</Val>, on
                      sort des fourchettes publiées. Le calcul suivra quand
                      même, et le signalera sur le roadbook.
                    </Notice>
                  )}
                  {cibles.carbsGH > CARBS_SINGLE_SOURCE_MAX_G_H && (
                    <Hint>
                      Au-dessus de {CARBS_SINGLE_SOURCE_MAX_G_H} g/h, un seul
                      type de sucre ne passe plus : il faut au moins un produit
                      qui annonce un mélange glucose et fructose.
                    </Hint>
                  )}
                </div>

                <Rule className="lg:hidden" />

                <div className="flex flex-col gap-3 lg:flex-1 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                  <Reglage
                    label="Boisson"
                    unite="mL/h"
                    value={cibles.fluidMlH}
                    crans={paliersBoisson(cibles.fluidMlH)}
                    onChange={(fluidMlH) =>
                      change(() => setCibles({ ...cibles, fluidMlH }))
                    }
                  />
                  {cibles.fluidMlH > FLUID_GUIDE_ML_H && (
                    <Notice code="fluid-above-guide">
                      Au-delà de{" "}
                      <Val unite="mL/h">{entier(FLUID_GUIDE_ML_H)}</Val>, le
                      risque n'est plus la déshydratation mais l'excès d'eau.
                    </Notice>
                  )}
                </div>

                <Rule className="lg:hidden" />

                <div className="flex flex-col gap-3 lg:flex-1 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                  <Reglage
                    label="Sodium dans la boisson"
                    unite="mg/L"
                    value={cibles.sodiumMgL}
                    crans={paliersSodium(cibles.sodiumMgL)}
                    onChange={(sodiumMgL) =>
                      change(() => setCibles({ ...cibles, sodiumMgL }))
                    }
                  />
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHead
                titre="Flasques emportées"
                aide="Sans flasque, le roadbook ne dit pas où verser la boisson."
              />
              <Rule />

              <div className="flex flex-col gap-3 p-4">
                {lignes.length === 0 && (
                  <EmptyNote titre="Rien à porter pour l'instant">
                    Ajoutez au moins un contenant : le calcul a besoin de savoir
                    dans quoi la boisson part.
                  </EmptyNote>
                )}

                {lignes.map((ligne, i) => (
                  <div key={ligne.id} className="flex items-end gap-3">
                    {/* Le libellé du champ dit déjà « Flasque N » : une icône
                        de flasque identique à côté ne distingue rien, elle
                        répète ce que le texte a déjà dit. */}
                    <MeasureField
                      label={`Flasque ${i + 1}`}
                      unite="mL"
                      placeholder="500"
                      largeur="w-32"
                      value={ligne.volumeMl}
                      onChange={(event) =>
                        change(() =>
                          setLignes(
                            lignes.map((l, j) =>
                              j === i
                                ? { ...l, volumeMl: event.target.value }
                                : l,
                            ),
                          ),
                        )
                      }
                    />

                    <div className="flex flex-1 items-center gap-2 pb-1">
                      <ToggleChip
                        actif={ligne.onlyWater}
                        onChange={(onlyWater) =>
                          change(() =>
                            setLignes(
                              lignes.map((l, j) =>
                                j === i ? { ...l, onlyWater } : l,
                              ),
                            ),
                          )
                        }
                      >
                        eau claire seulement
                      </ToggleChip>
                    </div>

                    <div className="pb-1">
                      <IconButton
                        libelle={`Retirer la flasque ${i + 1}`}
                        onClick={() =>
                          change(() =>
                            setLignes(lignes.filter((_, j) => j !== i)),
                          )
                        }
                      >
                        <TrashIcon className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}

                <Button
                  taille="sm"
                  icone={<PlusIcon className="size-4" />}
                  className="self-start"
                  onClick={() =>
                    change(() =>
                      setLignes([
                        ...lignes,
                        { id: nouvelId(), volumeMl: "500", onlyWater: false },
                      ]),
                    )
                  }
                >
                  Ajouter une flasque
                </Button>
              </div>
            </Panel>
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

      <div className="shrink-0 border-line border-t bg-paper">
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

/** Les contenances déjà lisibles, pour la synthèse affichée au fil de la saisie. */
function volumesLisibles(lignes: FlaskRow[]): Flask[] {
  return lignes.flatMap((ligne) => {
    const volumeMl = toNumber(ligne.volumeMl);

    return volumeMl === undefined || volumeMl <= 0
      ? []
      : [{ volumeMl, onlyWater: ligne.onlyWater }];
  });
}
