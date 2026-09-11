"use client";

import { DomEvent, type LatLngBounds } from "leaflet";
import { type ReactNode, type RefObject, useCallback } from "react";
import { useMap } from "react-leaflet";
import { FrameIcon, MinusIcon, PlusIcon } from "@/ui/icons";
import { cadrer, type Reserves } from "./mapFraming";

/**
 * Les commandes de la carte déplaçable, dessinées dans la langue du carnet
 * plutôt qu'avec le contrôle de zoom de Leaflet, qui arrive en boîte blanche
 * et en Arial.
 *
 * `disableClickPropagation` est indispensable : Leaflet écoute en natif sur
 * le conteneur, et un `stopPropagation` React n'atteindrait pas ces
 * écouteurs. Sans lui, un clic sur « + » poserait aussi un ravito.
 */
export function ControlesCarte({
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
