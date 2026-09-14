"use client";

import { useEffect, useMemo, useState } from "react";
import type { Reserves } from "@/ui/track/RouteMap";

// La hauteur de la feuille repliée, en dur ici comme en classe dans
// `RaceScreen` : c'est la même décision de mise en page, et la carte doit la
// connaître en pixels pour cadrer la trace au-dessus.
const FEUILLE_REPLIEE = 0.46;
/** La largeur de la colonne de papier à partir de `lg`, `w-[27rem]`. */
const COLONNE_LG = 432;

// Ce que l'interface pose par-dessus la carte, pour que le recadrage vise
// le vide plutôt que le cadre entier : la feuille montante au pouce, la
// colonne de saisie sur grand écran. Le socle du profil, lui, est déjà
// hors de la carte — elle s'arrête à `lg:bottom-72`.
export function useReserves(): Reserves {
  const [large, setLarge] = useState<boolean | null>(null);

  useEffect(() => {
    const requete = window.matchMedia("(min-width: 1024px)");
    const suivre = () => setLarge(requete.matches);

    suivre();
    requete.addEventListener("change", suivre);

    return () => requete.removeEventListener("change", suivre);
  }, []);

  return useMemo(
    (): Reserves =>
      large === null
        ? {}
        : large
          ? { left: COLONNE_LG }
          : {
              bottom: Math.round(window.innerHeight * FEUILLE_REPLIEE),
            },
    [large],
  );
}
