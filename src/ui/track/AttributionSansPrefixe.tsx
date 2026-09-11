"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * La mention légale d'OpenStreetMap est obligatoire ; le préfixe que Leaflet
 * y ajoute ne l'est pas, et il publie un drapeau en emoji que la voix du
 * produit interdit. Le contrôle se repose à la main, sans préfixe.
 */
export function AttributionSansPrefixe() {
  const map = useMap();

  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);

  return null;
}
