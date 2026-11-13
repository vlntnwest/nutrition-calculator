"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Result } from "@/app/plans/actions";

/**
 * Le temps qu'on laisse à une saisie pour se poser avant de l'écrire. Assez
 * court pour qu'un clic semble écrit sur le coup, assez long pour qu'un
 * chiffre tapé en trois touches ne parte pas trois fois.
 */
const POSE_MS = 500;

/**
 * L'écriture d'un plan, telle que ses écrans la font tous : chaque geste part
 * au serveur, il n'y a pas de bouton pour le valider.
 *
 * Next envoie les actions d'un même client l'une après l'autre : deux
 * écritures rapprochées arrivent dans l'ordre, et la dernière l'emporte. Le
 * rafraîchissement ne suit que la dernière. Les props des écrans viennent du
 * serveur, rail et pastilles compris, et une écriture plus récente les
 * périmerait de toute façon.
 */
export function useEcriture<T>(
  ecrire: (valeur: T) => Promise<Result<unknown>>,
) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, start] = useTransition();
  const derniere = useRef(0);

  function envoyer(valeur: T) {
    const numero = ++derniere.current;

    start(async () => {
      const result = await ecrire(valeur);
      if (numero !== derniere.current) return;

      setErreur(result.ok ? null : result.error);
      router.refresh();
    });
  }

  return {
    envoyer,
    /** Une écriture est partie, et l'écran n'a pas encore relu le serveur. */
    enCours,
    erreur,
    effacerErreur: () => setErreur(null),
  };
}

/**
 * Écrit `valeur` dès qu'elle change, une fois la saisie posée.
 *
 * `valeur` est ce que l'écran écrirait s'il fallait écrire maintenant : elle
 * se recalcule à chaque rendu, et rien ne part tant qu'elle ne bouge pas. Celle
 * du premier rendu vient du serveur et ne se renvoie pas. Une saisie revenue à
 * ce qui était déjà écrit avant la fin du délai ne part pas non plus.
 *
 * Quitter l'écran, ou masquer l'onglet, écrit sans attendre ce qui restait en
 * suspens : on change de destination d'un clic, et le délai ne doit rien
 * perdre en route.
 */
export function useAutosave<T>(
  valeur: T,
  ecrire: (valeur: T) => Promise<Result<unknown>>,
): string | null {
  const router = useRouter();
  const { envoyer, erreur } = useEcriture(ecrire);
  const cle = JSON.stringify(valeur);
  const ecrite = useRef(cle);

  /** Écrit la valeur du dernier rendu, si elle n'est pas déjà partie. */
  const partir = useEffectEvent((demonte: boolean) => {
    if (cle === ecrite.current) return;

    ecrite.current = cle;
    // Une fois l'écran démonté, sa transition n'a plus personne à tenir au
    // courant : l'écriture part seule, et le rafraîchissement sert l'écran
    // suivant, dont les pastilles doivent la voir.
    if (demonte) void ecrire(valeur).then(() => router.refresh());
    else envoyer(valeur);
  });

  useEffect(() => {
    if (cle === ecrite.current) return;

    const minuteur = setTimeout(() => partir(false), POSE_MS);

    return () => clearTimeout(minuteur);
  }, [cle]);

  useEffect(() => {
    function masque() {
      if (document.visibilityState === "hidden") partir(false);
    }

    document.addEventListener("visibilitychange", masque);

    return () => {
      document.removeEventListener("visibilitychange", masque);
      partir(true);
    };
  }, []);

  return erreur;
}
