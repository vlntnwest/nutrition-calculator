"use client";

import type { Path } from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Un CircleMarker ne prend qu'une seule couleur de remplissage — pas de quoi
 * peindre un damier. Le tour passe par le SVG que Leaflet dessine déjà
 * derrière ces marqueurs : on y glisse un `<pattern>` et le marqueur d'arrivée
 * s'en sert comme `fillColor` (`url(#id)`), une astuce SVG standard plutôt
 * qu'une fonctionnalité Leaflet. `map.getRenderer` garantit que ce SVG existe
 * déjà, sans dépendre de l'ordre de montage face aux autres calques.
 *
 * Motif calé sur la boîte du marqueur (`objectBoundingBox`) et non sur
 * l'espace de la carte : une tuile de deux cases sur deux mesure les deux
 * tiers du disque, donc toujours trois cases par côté, quel que soit
 * l'endroit où l'arrivée tombe sur la carte.
 */
export function DamierArrivee({ id }: { id: string }) {
  const map = useMap();

  useEffect(() => {
    const renderer = map.getRenderer({ options: {} } as unknown as Path);
    const svg = (renderer as unknown as { _container?: SVGSVGElement })
      ._container;
    if (!svg) return;

    const ns = "http://www.w3.org/2000/svg";
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(ns, "defs");
      svg.prepend(defs);
    }

    const pattern = document.createElementNS(ns, "pattern");
    pattern.setAttribute("id", id);
    pattern.setAttribute("width", String(2 / 3));
    pattern.setAttribute("height", String(2 / 3));
    pattern.setAttribute("patternUnits", "objectBoundingBox");
    pattern.setAttribute("viewBox", "0 0 2 2");
    pattern.innerHTML =
      '<rect width="2" height="2" fill="var(--paper)" />' +
      '<rect width="1" height="1" fill="var(--ink)" />' +
      '<rect x="1" y="1" width="1" height="1" fill="var(--ink)" />';
    defs.appendChild(pattern);

    return () => {
      pattern.remove();
    };
  }, [map, id]);

  return null;
}
