"use client";

import "leaflet/dist/leaflet.css";
import {
  DomEvent,
  type LatLngBounds,
  type Map as LeafletMap,
  latLngBounds,
  type Path,
} from "leaflet";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { FrameIcon, MinusIcon, PlusIcon } from "@/ui/icons";
import { nearestPointIndex } from "./nearestPoint";

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
function cadrer(map: LeafletMap, bounds: LatLngBounds, reserves: Reserves) {
  map.stop();
  map.fitBounds(bounds, { ...bornage(reserves), animate: false });
}

/** Les réserves en options de `fitBounds`. Un point Leaflet se lit `[x, y]`. */
function bornage(reserves: Reserves): {
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
function FitBoundsOnResize({
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
function MarqueDeplacement({ deplacee }: { deplacee: RefObject<boolean> }) {
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

/**
 * Les commandes de la carte déplaçable, dessinées dans la langue du carnet
 * plutôt qu'avec le contrôle de zoom de Leaflet, qui arrive en boîte blanche
 * et en Arial.
 *
 * `disableClickPropagation` est indispensable : Leaflet écoute en natif sur
 * le conteneur, et un `stopPropagation` React n'atteindrait pas ces
 * écouteurs. Sans lui, un clic sur « + » poserait aussi un ravito.
 */
function ControlesCarte({
  bounds,
  reserves,
  deplacee,
}: {
  bounds: LatLngBounds;
  reserves: Reserves;
  deplacee: RefObject<boolean>;
}) {
  const map = useMap();

  const isole = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    DomEvent.disableClickPropagation(element);
    DomEvent.disableScrollPropagation(element);
  }, []);

  return (
    <div
      ref={isole}
      className="absolute top-3 right-3 z-[1000] flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-line bg-veil shadow-[var(--shadow-panel)]"
    >
      <Commande
        libelle="Zoomer"
        onClick={() => {
          deplacee.current = true;
          map.zoomIn();
        }}
      >
        <PlusIcon className="size-4" />
      </Commande>
      <span className="h-px bg-line" aria-hidden="true" />
      <Commande
        libelle="Dézoomer"
        onClick={() => {
          deplacee.current = true;
          map.zoomOut();
        }}
      >
        <MinusIcon className="size-4" />
      </Commande>
      <span className="h-px bg-line" aria-hidden="true" />
      <Commande
        libelle="Recadrer sur la trace"
        onClick={() => {
          deplacee.current = false;
          cadrer(map, bounds, reserves);
        }}
      >
        <FrameIcon className="size-4" />
      </Commande>
    </div>
  );
}

function Commande({
  libelle,
  onClick,
  children,
}: {
  libelle: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      title={libelle}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:bg-paper/70 hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * La mention légale d'OpenStreetMap est obligatoire ; le préfixe que Leaflet
 * y ajoute ne l'est pas, et il publie un drapeau en emoji que la voix du
 * produit interdit. Le contrôle se repose à la main, sans préfixe.
 */
function AttributionSansPrefixe() {
  const map = useMap();

  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);

  return null;
}

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
