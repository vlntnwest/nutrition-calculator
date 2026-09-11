"use client";

import type { LatLngBounds } from "leaflet";
import { type RefObject, useEffect } from "react";
import { useMap } from "react-leaflet";
import { cadrer, type Reserves } from "./mapFraming";

/**
 * La fiche vit dans un `<dialog>` natif, en `display:none` tant que
 * `showModal` n'a pas tourné. Si le conteneur mesure zéro à ce moment,
 * Leaflet en tire un centrage et un zoom qui n'ont plus de rapport avec le
 * tracé — `invalidateSize` seul ne les recalcule pas, il ne fait que réagir
 * à la taille. Il faut aussi rejouer `fitBounds` : d'où une carte tantôt
 * juste, tantôt égarée sur un coin de la carte, selon que le montage gagne
 * ou perd la course contre l'ouverture réelle de la boîte.
 *
 * Sur une carte qu'on peut déplacer, ce recadrage doit s'arrêter à la
 * première main posée dessus : la feuille du bas change de hauteur au pouce,
 * et sans ce garde-fou chaque repli ramènerait la vue au départ.
 */
export function FitBoundsOnResize({
  bounds,
  reserves,
  deplacee,
}: {
  bounds: LatLngBounds;
  reserves: Reserves;
  deplacee: RefObject<boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    const conteneur = map.getContainer();
    const observateur = new ResizeObserver(() => {
      if (conteneur.clientWidth === 0 || conteneur.clientHeight === 0) return;
      map.invalidateSize();
      if (!deplacee.current) cadrer(map, bounds, reserves);
    });

    observateur.observe(conteneur);

    return () => observateur.disconnect();
  }, [map, bounds, reserves, deplacee]);

  return null;
}
