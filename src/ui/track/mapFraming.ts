import type { LatLngBounds, Map as LeafletMap } from "leaflet";

const MARGE = 18;

/**
 * Ce qui recouvre la carte sans faire partie d'elle, en pixels.
 *
 * La carte occupe tout le cadre et l'interface se pose dessus : la feuille de
 * papier qui monte du bas au pouce, la colonne de saisie à gauche sur grand
 * écran. Sans ces réserves, le recadrage centre la trace sur le cadre entier,
 * donc à moitié sous ce qui la couvre. Les réserves la ramènent au centre de
 * ce qui se voit vraiment.
 */
export type Reserves = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

/**
 * Le recadrage ne s'anime pas, et coupe ce qui vole encore.
 *
 * Un `fitBounds` animé lancé alors qu'un zoom n'a pas fini atterrit court :
 * il fallait cliquer deux fois sur « recadrer » pour revenir vraiment sur la
 * trace. Et c'est plus juste ainsi : on demande à revenir, on revient.
 */
export function cadrer(
  map: LeafletMap,
  bounds: LatLngBounds,
  reserves: Reserves,
) {
  map.stop();
  map.fitBounds(bounds, { ...bornage(reserves), animate: false });
}

/** Les réserves en options de `fitBounds`. Un point Leaflet se lit `[x, y]`. */
export function bornage(reserves: Reserves): {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
} {
  return {
    paddingTopLeft: [MARGE + (reserves.left ?? 0), MARGE + (reserves.top ?? 0)],
    paddingBottomRight: [
      MARGE + (reserves.right ?? 0),
      MARGE + (reserves.bottom ?? 0),
    ],
  };
}
