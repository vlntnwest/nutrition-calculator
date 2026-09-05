"use client";

import "leaflet/dist/leaflet.css";
import { type LatLngBounds, latLngBounds, type Path } from "leaflet";
import { useEffect, useId, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import { nearestPointIndex } from "./nearestPoint";

/**
 * La fiche vit dans un `<dialog>` natif, en `display:none` tant que
 * `showModal` n'a pas tourné. Si le conteneur mesure zéro à ce moment,
 * Leaflet en tire un centrage et un zoom qui n'ont plus de rapport avec le
 * tracé — `invalidateSize` seul ne les recalcule pas, il ne fait que réagir
 * à la taille. Il faut aussi rejouer `fitBounds` : d'où une carte tantôt
 * juste, tantôt égarée sur un coin de la carte, selon que le montage gagne
 * ou perd la course contre l'ouverture réelle de la boîte.
 */
function FitBoundsOnResize({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    const conteneur = map.getContainer();
    const observateur = new ResizeObserver(() => {
      if (conteneur.clientWidth === 0 || conteneur.clientHeight === 0) return;
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [18, 18] });
    });

    observateur.observe(conteneur);

    return () => observateur.disconnect();
  }, [map, bounds]);

  return null;
}

/**
 * Un CircleMarker ne prend qu'une seule couleur de remplissage — pas de quoi
 * peindre un damier. Le tour passe par le SVG que Leaflet dessine déjà
 * derrière ces marqueurs : on y glisse un `<pattern>` et le marqueur d'arrivée
 * s'en sert comme `fillColor` (`url(#id)`), une astuce SVG standard plutôt
 * qu'une fonctionnalité Leaflet. `map.getRenderer` garantit que ce SVG existe
 * déjà, sans dépendre de l'ordre de montage face aux autres calques.
 */
function DamierArrivee({ id }: { id: string }) {
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
    pattern.setAttribute("width", "6");
    pattern.setAttribute("height", "6");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.innerHTML =
      '<rect width="6" height="6" fill="#ffffff" />' +
      '<rect width="2" height="2" fill="#171717" />' +
      '<rect x="4" width="2" height="2" fill="#171717" />' +
      '<rect x="2" y="2" width="2" height="2" fill="#171717" />' +
      '<rect y="4" width="2" height="2" fill="#171717" />' +
      '<rect x="4" y="4" width="2" height="2" fill="#171717" />';
    defs.appendChild(pattern);

    return () => {
      pattern.remove();
    };
  }, [map, id]);

  return null;
}

/**
 * Le tracé sur un vrai fond de carte plutôt qu'une silhouette dessinée : la
 * confirmation qu'on parle du bon relief passe aussi par le terrain
 * traversé, pas seulement par sa forme. Fond OpenStreetMap standard : le
 * seul qui reste vraiment sans clé d'API — CARTO, plus proche du
 * papier/encre du reste de la fiche, filigrane désormais ses tuiles
 * anonymes d'un « API KEY » tant qu'aucune n'est fournie.
 *
 * Non interactif : c'est une confirmation d'un coup d'œil dans une fiche,
 * pas un outil de navigation. `dynamic(..., { ssr: false })` l'importe côté
 * client uniquement — Leaflet lit `window` dès son chargement.
 *
 * `hoverIndex` vient du profil ou de la carte elle-même, au choix de qui
 * survole en premier : même tableau `points`, même indice, aucun des deux
 * composants n'a jamais besoin de connaître une coordonnée en tant que
 * telle. `onHoverIndex` fait le chemin inverse — survoler le tracé retrouve
 * le point le plus proche et le fait remonter, pour que le profil le
 * surligne à son tour.
 *
 * `positions`/`bounds` sont mémoïsés sur `points` : sans ça, chaque survol
 * change `hoverIndex` chez le parent, qui refait tout rendre — et Leaflet
 * refaisait le tracé complet et recentrait la carte (`fitBounds`) à chaque
 * déplacement de souris plutôt qu'une seule fois, à l'ouverture.
 */
export default function RouteMap({
  points,
  hoverIndex,
  onHoverIndex,
}: {
  points: { lat: number; lon: number }[];
  hoverIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
}) {
  const positions = useMemo(
    (): [number, number][] => points.map((p) => [p.lat, p.lon]),
    [points],
  );
  const bounds = useMemo(() => latLngBounds(positions), [positions]);
  const survole = hoverIndex != null ? (points[hoverIndex] ?? null) : null;
  const idDamier = `damier-arrivee-${useId().replace(/:/g, "")}`;

  if (points.length === 0) return null;

  const depart = points[0];
  const arrivee = points[points.length - 1];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [18, 18] }}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      zoomControl={false}
      className="h-full w-full"
    >
      <FitBoundsOnResize bounds={bounds} />
      <DamierArrivee id={idDamier} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Polyline
        positions={positions}
        pathOptions={{ color: "var(--accent)", weight: 3.5 }}
      />
      {onHoverIndex && (
        // Ligne invisible et large : le trait visible ne fait que 3,5 px, une
        // cible bien trop fine pour viser au pixel près sur un tracé courbe.
        <Polyline
          positions={positions}
          pathOptions={{ opacity: 0, weight: 16 }}
          eventHandlers={{
            mousemove: (event) => {
              onHoverIndex(
                nearestPointIndex(points, event.latlng.lat, event.latlng.lng),
              );
            },
            mouseout: () => onHoverIndex(null),
          }}
        />
      )}
      <CircleMarker
        center={[depart.lat, depart.lon]}
        radius={6}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor: "#2f6b3f",
          fillOpacity: 1,
        }}
        interactive={false}
      />
      <CircleMarker
        center={[arrivee.lat, arrivee.lon]}
        radius={6}
        pathOptions={{
          color: "#171717",
          weight: 1.5,
          fillColor: `url(#${idDamier})`,
          fillOpacity: 1,
        }}
        interactive={false}
      />
      {survole && (
        <CircleMarker
          center={[survole.lat, survole.lon]}
          radius={6}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: "var(--accent)",
            fillOpacity: 1,
          }}
          interactive={false}
        />
      )}
    </MapContainer>
  );
}
