"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { computePlan } from "@/app/plans/actions";

export function Calculer({
  accessId,
  calcule,
  edited,
}: {
  accessId: string;
  calcule: boolean;
  edited: boolean;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  // Un recalcul repart de zéro : sur un plan retouché, on demande confirmation
  // avant d'écraser. Deux temps sur le bouton plutôt qu'une fenêtre modale,
  // qui bloquerait tout pour dire la même chose. ADR 011.
  const [confirme, setConfirme] = useState(false);
  const [pending, start] = useTransition();

  const aConfirmer = edited && !confirme;

  function libelle(): string {
    if (pending) return "Calcul…";
    if (confirme) return "Ça écrasera tes retouches. Confirmer ?";

    return calcule ? "Recalculer" : "Calculer";
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="border px-3 py-1 font-semibold"
        disabled={pending}
        onClick={() => {
          setErreur(null);
          if (aConfirmer) {
            setConfirme(true);

            return;
          }

          start(async () => {
            const result = await computePlan(accessId);
            if (result.ok) {
              setConfirme(false);
              // Les lectures ne passent pas par le cache de Next : c'est le
              // rendu du serveur qu'il faut refaire, pas une donnée à périmer.
              router.refresh();
            } else {
              setErreur(result.error);
            }
          });
        }}
      >
        {libelle()}
      </button>
      {erreur && <p role="alert">{erreur}</p>}
    </div>
  );
}
