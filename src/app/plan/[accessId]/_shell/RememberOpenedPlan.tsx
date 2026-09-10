"use client";

import { useEffect } from "react";
import { rememberPlan } from "@/app/plans/stored";

/**
 * L'appareil retient le plan qu'il ouvre, et pas seulement celui qu'il crée :
 * un plan reçu par lien n'apparaissait jamais dans « mes plans ».
 *
 * Après le montage, `localStorage` n'ayant pas d'existence côté serveur. La
 * coquille a déjà rendu le 404 si le plan manque : on ne retient donc que des
 * identifiants qui ouvrent quelque chose.
 */
export function RememberOpenedPlan({ accessId }: { accessId: string }) {
  useEffect(() => {
    rememberPlan(accessId);
  }, [accessId]);

  return null;
}
