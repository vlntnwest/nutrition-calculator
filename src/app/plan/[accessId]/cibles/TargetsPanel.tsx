"use client";

import {
  CARBS_GUIDE_G_H,
  CARBS_SINGLE_SOURCE_MAX_G_H,
  FLUID_GUIDE_ML_H,
} from "@/core/guides";
import type { Targets } from "@/core/type";
import { entier } from "@/format/number";
import { Hint } from "@/ui/Field";
import { Val } from "@/ui/Measure";
import { Notice } from "@/ui/Notice";
import { Panel, Rule } from "@/ui/Panel";
import { Reglage } from "@/ui/Reglage";
import { paliersBoisson, paliersGlucides, paliersSodium } from "./paliers";

export function TargetsPanel({
  cibles,
  onChange,
}: {
  cibles: Targets;
  onChange: (suite: Targets) => void;
}) {
  return (
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
            onChange={(carbsGH) => onChange({ ...cibles, carbsGH })}
          />
          {cibles.carbsGH > CARBS_GUIDE_G_H && (
            <Notice>
              Au-delà de <Val unite="g/h">{CARBS_GUIDE_G_H}</Val>, on sort des
              fourchettes publiées. Le calcul suivra quand même, et le signalera
              sur le roadbook.
            </Notice>
          )}
          {cibles.carbsGH > CARBS_SINGLE_SOURCE_MAX_G_H && (
            <Hint>
              Au-dessus de {CARBS_SINGLE_SOURCE_MAX_G_H} g/h, un seul type de
              sucre ne passe plus : il faut au moins un produit qui annonce un
              mélange glucose et fructose.
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
            onChange={(fluidMlH) => onChange({ ...cibles, fluidMlH })}
          />
          {cibles.fluidMlH > FLUID_GUIDE_ML_H && (
            <Notice>
              Au-delà de <Val unite="mL/h">{entier(FLUID_GUIDE_ML_H)}</Val>, le
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
            onChange={(sodiumMgL) => onChange({ ...cibles, sodiumMgL })}
          />
        </div>
      </div>
    </Panel>
  );
}
