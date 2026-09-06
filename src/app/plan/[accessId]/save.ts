"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePlan } from "@/app/plans/actions";
import type { PlanPatch } from "@/app/plans/updatePlan";

/**
 * L'enregistrement, tel que les quatre écrans de saisie le font tous.
 *
 * Les props des écrans viennent du serveur : sans `router.refresh()`, ils
 * continueraient d'annoncer l'état d'avant l'enregistrement, rail et
 * pastilles compris.
 */
export function usePlanSave(accessId: string) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [pending, start] = useTransition();

  function save(patch: PlanPatch, apres?: () => void) {
    setErreur(null);
    start(async () => {
      const result = await savePlan(accessId, patch);
      if (!result.ok) {
        setErreur(result.error);

        return;
      }
      setEnregistre(true);
      apres?.();
      router.refresh();
    });
  }

  /** Une saisie reprend : la confirmation précédente ne vaut plus. */
  function reprise() {
    setEnregistre(false);
    setErreur(null);
  }

  return { pending, erreur, enregistre, save, reprise };
}
