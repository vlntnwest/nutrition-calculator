import type { Roadbook } from "@/app/plans/roadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { nomProduit } from "@/format/produit";

/** La portée où tombe un secteur : là où ses flasques se préparent. */
export type Portee = {
  /** Le rang du secteur qui l'ouvre — lui-même, ou un secteur en amont. */
  rank: number;
  /** Le ravito où l'on charge en l'ouvrant. Nul au départ de la course. */
  ravito: string | null;
  /**
   * Ce qu'il y a à boire sur toute la portée — voir `spanFluidNeedMl`. Égal
   * à `leg.needFluidMl` dès que le ravito suivant donne de l'eau.
   */
  besoinMl: number;
  /** Les remplissages du secteur qui l'ouvre, seul à en porter. */
  remplissages: RoadbookEdit["fills"][number];
};

/**
 * Où se prend la nourriture d'ici : le dernier ravito qui en donnait, et le
 * secteur qu'il ouvre. Ce secteur est celui-ci quand il en ouvre une portée.
 */
export type PriseSolide = { rank: number; ravito: string | null };

/**
 * Nommer le ravito plutôt que le secteur qu'il ouvre : les deux numérotations
 * se croisent — un secteur finit au ravito de son rang et commence à celui
 * d'avant — et « au secteur 5 » se lit « au Ravito 5 » alors que c'est le 4.
 */
export function lieu(o: { rank: number; ravito: string | null }): string {
  return o.ravito === null ? "au départ" : `à ${o.ravito}`;
}

type Catalogue = Roadbook["catalogue"];

export function produitDe(catalogue: Catalogue, id: string) {
  return catalogue.find((p) => p.id === id);
}

/** La marque et le nom, tels qu'un menu ou un libellé les portent. */
export function nomDe(catalogue: Catalogue, id: string): string {
  const p = produitDe(catalogue, id);

  return p ? `${p.brandName ?? ""} ${nomProduit(p.name)}`.trim() : id;
}

/** Ce qui ne se dilue pas : la ration reste, la flasque ne la porte pas. */
export function estSolide(catalogue: Catalogue, id: string): boolean {
  return produitDe(catalogue, id)?.fluidMl === 0;
}
