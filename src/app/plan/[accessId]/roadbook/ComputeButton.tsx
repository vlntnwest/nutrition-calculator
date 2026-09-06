"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { computePlan } from "@/app/plans/actions";
import { Button } from "@/ui/Button";
import { RecomputeIcon, SpinnerIcon } from "@/ui/icons";
import { ErrorNote } from "@/ui/Notice";

export function ComputeButton({
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

  function label(): string {
    if (pending) return "Calcul";
    if (confirme) return "Confirmer, les retouches seront écrasées";

    return calcule ? "Recalculer" : "Calculer le roadbook";
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        ton={confirme ? "encre" : calcule ? "contour" : "encre"}
        disabled={pending}
        icone={
          pending ? (
            <SpinnerIcon className="size-4" />
          ) : (
            <RecomputeIcon className="size-4" />
          )
        }
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
        {label()}
      </Button>
      {erreur && <ErrorNote>{erreur}</ErrorNote>}
    </div>
  );
}

/**
 * Depuis quand le calcul date. Rendu après le montage seulement : l'écart au
 * présent n'a pas de valeur stable entre le serveur et le navigateur, et une
 * heure absolue dépendrait du fuseau du serveur.
 */
export function CalculeDepuis({ at }: { at: string }) {
  const [texte, setTexte] = useState<string | null>(null);

  useEffect(() => {
    function poser() {
      const minutes = Math.round((Date.now() - Date.parse(at)) / 60000);
      if (minutes < 1) return setTexte("à l'instant");
      if (minutes < 60) return setTexte(`il y a ${minutes} min`);
      const heures = Math.round(minutes / 60);
      if (heures < 24) return setTexte(`il y a ${heures} h`);

      setTexte(
        new Date(at).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
        }),
      );
    }

    poser();
    const timer = setInterval(poser, 30000);

    return () => clearInterval(timer);
  }, [at]);

  return texte === null ? null : <>calculé {texte}</>;
}
