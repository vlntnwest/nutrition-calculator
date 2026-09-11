"use client";

import { useMemo } from "react";
import type { ProfilePoint } from "@/core/type";
import { paceLabel } from "@/format/clock";
import { toNumber } from "@/format/number";
import { paceAxisRange, paceBand, paceSegments } from "./pacing";
import type { Row } from "./stations";

/**
 * L'aperçu d'allure : ce que le chrono visé et les deux curseurs font au
 * parcours, avant qu'on enregistre quoi que ce soit.
 */
export function usePacePreview({
  profile,
  lignes,
  targetTimeS,
  totalM,
  climb,
  split,
}: {
  profile: ProfilePoint[];
  lignes: Row[];
  targetTimeS: number | undefined;
  totalM: number;
  climb: number;
  split: number;
}) {
  // Le découpage ne dépend que du relief : il survit à tous les réglages
  // d'allure, et ne se refait pas quand un curseur bouge.
  const segments = useMemo(() => paceSegments(profile), [profile]);

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

  return { arretsS, allure, bande, axeAllure };
}
