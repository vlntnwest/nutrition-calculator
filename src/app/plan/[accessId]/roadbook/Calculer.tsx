"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { computePlan } from "@/app/plans/actions";

export function Calculer({
  accessId,
  calcule,
}: {
  accessId: string;
  calcule: boolean;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="border px-3 py-1 font-semibold"
        disabled={pending}
        onClick={() => {
          setErreur(null);
          start(async () => {
            const result = await computePlan(accessId);
            if (result.ok) {
              // Les lectures ne passent pas par le cache de Next : c'est le
              // rendu du serveur qu'il faut refaire, pas une donnée à périmer.
              router.refresh();
            } else {
              setErreur(result.error);
            }
          });
        }}
      >
        {pending ? "Calcul…" : calcule ? "Recalculer" : "Calculer"}
      </button>
      {erreur && <p role="alert">{erreur}</p>}
    </div>
  );
}
