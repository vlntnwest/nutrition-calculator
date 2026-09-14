"use client";

import "leaflet/dist/leaflet.css";
import { DomEvent, latLngBounds } from "leaflet";
import { useId, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import { AttributionSansPrefixe } from "./AttributionSansPrefixe";
import { ControlesCarte } from "./ControlesCarte";
import { DamierArrivee } from "./DamierArrivee";
import { FitBoundsOnResize } from "./FitBoundsOnResize";
import { MarqueDeplacement } from "./MarqueDeplacement";
import { bornage, type Reserves } from "./mapFraming";
import { nearestPointIndex } from "./nearestPoint";

export type { Reserves } from "./mapFraming";

/**
 * Le tracé sur un vrai fond de carte plutôt qu'une silhouette dessinée : la
 * confirmation qu'on parle du bon relief passe aussi par le terrain
 * traversé, pas seulement par sa forme. Fond OpenStreetMap standard : le
 * seul qui reste vraiment sans clé d'API — CARTO, plus proche du
 * papier/encre du reste de la fiche, filigrane désormais ses tuiles
 * anonymes d'un « API KEY » tant qu'aucune n'est fournie.
 *
 * Fixe par défaut : dans la fiche d'import, c'est une confirmation d'un coup
 * d'œil, et une carte qui se déplace y volerait le geste au formulaire.
 * `deplacable` la rend manœuvrable là où elle sert d'instrument, sur l'écran
 * Course, où l'on vient chercher un endroit précis de la trace pour y poser
 * une borne. `dynamic(..., { ssr: false })` l'importe côté client
 * uniquement — Leaflet lit `window` dès son chargement.
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
  stations,
  onPick,
  onChoisirStation,
  reserves = {},
  deplacable = false,
}: {
  points: { lat: number; lon: number }[];
  hoverIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
  /** Les ravitos posés, chacun sur l'indice du point qui le porte. */
  stations?: { rank: number; index: number }[];
  /** Poser une borne au clic sur le tracé. Rend l'indice du point visé. */
  onPick?: (index: number) => void;
  /** Rappelle le rang du ravito cliqué. Absent, le marqueur reste inerte. */
  onChoisirStation?: (rank: number) => void;
  /** Ce que l'interface pose par-dessus la carte. Voir `Reserves`. */
  reserves?: Reserves;
  /** Glisser, zoomer, recadrer. Absent, la carte reste une image. */
  deplacable?: boolean;
}) {
  const positions = useMemo(
    (): [number, number][] => points.map((p) => [p.lat, p.lon]),
    [points],
  );
  const bounds = useMemo(() => latLngBounds(positions), [positions]);
  // Une ref plutôt qu'un état : le recadrage automatique la lit depuis un
  // `ResizeObserver`, et un rendu de plus n'apporterait rien à l'écran.
  const deplacee = useRef(false);
  const survole = hoverIndex != null ? (points[hoverIndex] ?? null) : null;
  const idDamier = `damier-arrivee-${useId().replace(/:/g, "")}`;

  if (points.length === 0) return null;

  const depart = points[0];
  const arrivee = points[points.length - 1];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={bornage(reserves)}
      dragging={deplacable}
      scrollWheelZoom={deplacable}
      doubleClickZoom={deplacable}
      touchZoom={deplacable}
      keyboard={deplacable}
      // L'inertie projette la carte loin sur un geste vif, et le tracé sort
      // du cadre. On vient chercher un endroit précis de la trace, pas
      // parcourir un atlas : la carte suit la main et s'arrête avec elle.
      // Borner le déplacement était pire : à ce zoom la vue remplit déjà le
      // cadre du tracé, et le moindre geste rebondissait. C'est le bouton
      // « recadrer » qui rattrape une vue égarée.
      inertia={false}
      zoomControl={false}
      // Le curseur en croix dit qu'on pose une borne, et il ne vaut donc que
      // pour le tracé : sur la borne elle-même, où le clic ouvre une carte,
      // c'est la main. La négation tient la cascade, deux règles de même
      // portée s'y départageant autrement à l'ordre d'écriture.
      className={`h-full w-full [&_.borne]:cursor-pointer ${onPick ? "[&_.leaflet-interactive:not(.borne)]:cursor-crosshair" : ""}`}
    >
      <AttributionSansPrefixe />
      <FitBoundsOnResize
        bounds={bounds}
        reserves={reserves}
        deplacee={deplacee}
      />
      {deplacable && (
        <>
          <MarqueDeplacement deplacee={deplacee} />
          <ControlesCarte
            bounds={bounds}
            reserves={reserves}
            deplacee={deplacee}
          />
        </>
      )}
      <DamierArrivee id={idDamier} />
      {/* Fond OpenStreetMap standard, le seul qui reste vraiment sans clé
          d'API. Ses couleurs sont les siennes et on les lui laisse : le
          terrain traversé se lit mieux dans sa propre langue, et
          l'interface, elle, n'en emprunte aucune. */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {/* Une gaine blanche sous le tracé : les tuiles gardent leurs
          couleurs, et c'est ce liseré qui détache l'encre de n'importe quel
          fond, vert de forêt comme gris de ville. Le procédé vient des
          cartes papier, où un trait ne compte jamais sur la teinte du
          support pour se lire. */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: "var(--paper)",
          weight: 7,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color: "var(--accent)",
          weight: 3.5,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      {(onHoverIndex || onPick) && (
        // Ligne invisible et large : le trait visible ne fait que 3,5 px, une
        // cible bien trop fine pour viser au pixel près sur un tracé courbe.
        <Polyline
          positions={positions}
          pathOptions={{ opacity: 0, weight: 16 }}
          eventHandlers={{
            mousemove: (event) => {
              onHoverIndex?.(
                nearestPointIndex(points, event.latlng.lat, event.latlng.lng),
              );
            },
            mouseout: () => onHoverIndex?.(null),
            click: (event) => {
              onPick?.(
                nearestPointIndex(points, event.latlng.lat, event.latlng.lng),
              );
            },
          }}
        />
      )}
      <CircleMarker
        center={[depart.lat, depart.lon]}
        radius={6}
        pathOptions={{
          color: "var(--paper)",
          weight: 2,
          fillColor: "var(--accent)",
          fillOpacity: 1,
        }}
        interactive={false}
      />
      <CircleMarker
        center={[arrivee.lat, arrivee.lon]}
        radius={6}
        pathOptions={{
          color: "var(--ink)",
          weight: 1.5,
          fillColor: `url(#${idDamier})`,
          fillOpacity: 1,
        }}
        interactive={false}
      />
      {/* Le marqueur d'un ravito est sa poignée : le viser ouvre sa carte
          plutôt que d'en poser un de plus par-dessus. Le disque se dessine
          au-dessus du tracé, le navigateur lui donne donc le clic sans que
          la ligne invisible qui pose les bornes ne le voie passer. Sans
          `onChoisirStation` il reste inerte, comme sur la fiche d'import. */}
      {stations?.map((station) => {
        const point = points[station.index];
        if (!point) return null;

        return (
          <CircleMarker
            key={`${station.rank}-${station.index}`}
            center={[point.lat, point.lon]}
            radius={9}
            pathOptions={{
              color: "var(--paper)",
              weight: 2,
              fillColor: "var(--accent)",
              fillOpacity: 1,
              className: onChoisirStation ? "borne" : undefined,
            }}
            interactive={onChoisirStation != null}
            eventHandlers={
              onChoisirStation && {
                click: (event) => {
                  DomEvent.stop(event.originalEvent);
                  onChoisirStation(station.rank);
                },
              }
            }
          >
            <Tooltip permanent direction="center" className="borne-ravito">
              {station.rank}
            </Tooltip>
          </CircleMarker>
        );
      })}
      {survole && (
        <CircleMarker
          center={[survole.lat, survole.lon]}
          radius={6}
          pathOptions={{
            color: "var(--paper)",
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
