"use client";

import { useId } from "react";
import { FieldLabel, Hint } from "./Field";
import { Select } from "./Select";

/** Une valeur proposée, et le seuil publié qu'elle marque le cas échéant. */
export type Cran = { valeur: number; mention?: string };

/**
 * Un réglage qui se choisit dans une liste plutôt qu'en glissant un curseur.
 *
 * Une cible horaire est un nombre que le coureur connaît — soixante-quinze
 * grammes, cinq cents millilitres — et qu'il vient poser, pas chercher. Le
 * curseur demandait de viser au pixel une valeur qu'on savait déjà, et il
 * capturait le doigt dans une colonne qui défile. La liste native pose la
 * valeur d'un geste, se tape au clavier, et le tactile la connaît par cœur.
 *
 * Elle porte en plus ce que le curseur ne savait pas dire : chaque seuil
 * publié s'écrit à côté de son cran, là où le choix se fait. Les réglages
 * sans unité connue — l'effort en montée, la dérive d'allure — restent des
 * curseurs : on les cherche au geste, faute de savoir ce qu'on veut.
 */
export function Reglage({
  label,
  unite,
  value,
  crans,
  aide,
  onChange,
}: {
  label: string;
  /** L'unité, écrite dans chaque option : c'est elle qui donne son sens au nombre. */
  unite: string;
  value: number;
  crans: Cran[];
  aide?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {/* Le mono vaut ici pour la liste ouverte, pas pour la valeur fermée :
          trente nombres alignés en colonne se lisent comme une échelle, et
          c'est ce qu'ils sont. L'unité y reste donc dans la fonte du chiffre,
          faute de pouvoir en changer à l'intérieur d'une `<option>` — la
          règle de l'unité s'applique là où deux fontes peuvent cohabiter. */}
      <Select
        id={id}
        taille="md"
        mesure
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {crans.map((cran) => (
          <option key={cran.valeur} value={cran.valeur}>
            {cran.valeur.toLocaleString("fr-FR")} {unite}
            {cran.mention ? ` · ${cran.mention}` : ""}
          </option>
        ))}
      </Select>
      {aide && <Hint>{aide}</Hint>}
    </div>
  );
}
