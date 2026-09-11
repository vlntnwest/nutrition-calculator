"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewAidStation } from "@/app/plans/planInput";
import type { ResolvedPoint } from "@/core/type";
import { toNumber } from "@/format/number";
import {
  insererTriee,
  kmTexte,
  pointIndexAt,
  type Row,
  rangees,
  toRow,
} from "./stations";

/**
 * L'édition des bornes : la pile de cartes, celle qui reste ouverte, et les
 * marqueurs que le profil et la carte en tirent.
 */
export function useStationEditing({
  aidStations,
  points,
  reprise,
  deplier,
}: {
  aidStations: NewAidStation[];
  points: ResolvedPoint[];
  /** Une saisie reprend : voir `usePlanSave`. */
  reprise: () => void;
  /** Au pouce, la feuille doit être dépliée pour qu'une carte se voie. */
  deplier: () => void;
}) {
  const [lignes, setLignes] = useState<Row[]>(aidStations.map(toRow));
  const [ouverte, setOuverte] = useState<number | null>(null);
  /** Le rang d'une borne à amener sous les yeux, le temps d'un rendu. */
  const [vise, setVise] = useState<number | null>(null);
  const [modifie, setModifie] = useState(false);
  const [reproche, setReproche] = useState<string | null>(null);

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
   * position d'avant ne bougeait presque pas la colonne. L'effet plus haut
   * défile une fois la mise en page faite, puis oublie le rang — sans quoi
   * replier la carte à la main ferait défiler à nouveau.
   */
  function ouvrir(rang: number) {
    setOuverte(rang - 1);
    deplier();
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

  return {
    lignes,
    setLignes,
    ouverte,
    setOuverte,
    modifie,
    setModifie,
    reproche,
    setReproche,
    change,
    poser,
    ouvrir,
    deplacer,
    bornes,
    marqueurs,
  };
}
