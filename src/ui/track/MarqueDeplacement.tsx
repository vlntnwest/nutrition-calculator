"use client";

import { type RefObject, useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Retient qu'une main s'est posée sur la carte.
 *
 * On écoute les **gestes**, pas leurs conséquences : `zoomstart` part aussi
 * sur le `fitBounds` de « recadrer », qui se réarmerait alors lui-même et
 * laisserait le recadrage automatique désarmé pour de bon. `dragstart` ne
 * vient que de la main ; la molette et le double-clic s'écoutent sur le
 * conteneur, et les deux boutons de zoom se marquent eux-mêmes. `dragend` et `zoomend`
 * partiraient aussi sur un `fitBounds` programmé : ce sont les gestes qui
 * font foi, pas leurs conséquences.
 */
export function MarqueDeplacement({
  deplacee,
}: {
  deplacee: RefObject<boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    function marquer() {
      deplacee.current = true;
    }

    const conteneur = map.getContainer();

    map.on("dragstart", marquer);
    conteneur.addEventListener("wheel", marquer, { passive: true });
    conteneur.addEventListener("dblclick", marquer);

    return () => {
      map.off("dragstart", marquer);
      conteneur.removeEventListener("wheel", marquer);
      conteneur.removeEventListener("dblclick", marquer);
    };
  }, [map, deplacee]);

  return null;
}
