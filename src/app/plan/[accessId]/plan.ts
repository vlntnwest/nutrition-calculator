import { cache } from "react";
import { getPlan } from "@/app/plans/getPlan";
import { getRoadbook } from "@/app/plans/getRoadbook";
import { getTrackPoints, getTrackProfile } from "@/app/plans/getTrack";

/**
 * Un seul aller-retour par requête, quel que soit le nombre de lecteurs.
 *
 * La disposition lit le plan pour savoir s'il existe, la page pour l'afficher :
 * `cache` de React dédoublonne à l'intérieur d'une requête, sans rien garder
 * d'une requête à l'autre — un plan change, il ne se met pas en cache.
 */
export const planOf = cache(getPlan);
export const roadbookOf = cache(getRoadbook);

/**
 * La géométrie, que seuls les écrans Course et Roadbook demandent. Elle ne
 * passe pas par `planOf` : la disposition et les deux écrans de saisie n'en
 * affichent rien, et c'est la plus lourde des colonnes.
 */
export const trackPointsOf = cache(getTrackPoints);
export const trackProfileOf = cache(getTrackProfile);
