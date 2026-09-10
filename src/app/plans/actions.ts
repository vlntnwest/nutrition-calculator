"use server";

import { pacingIssue } from "@/core/distribute";
import type { ProfilePoint, ResolvedPoint } from "@/core/type";
import { db } from "@/db";
import { createPlan } from "./createPlan";
import { duplicatePlan } from "./duplicatePlan";
import { getPlan } from "./getPlan";
import { officialRacePlanId, officialRacePoints } from "./officialRaces";
import { pacingIssueText } from "./pacingErrorText";
import { PlanError } from "./planError";
import type { LegOverride, StoredPlan } from "./planInput";
import { regeneratePlan } from "./regeneratePlan";
import type { RoadbookEdit } from "./saveRoadbook";
import { saveRoadbook } from "./saveRoadbook";
import type { PlanPatch } from "./updatePlan";
import { updatePlan } from "./updatePlan";

/**
 * Ce qu'une action rend.
 *
 * Un refus n'est pas une panne : ravitos trop proches, consigne posée hors
 * d'une borne, plan introuvable — l'écran doit les montrer. Or Next masque
 * les exceptions en production, où elles deviennent « An error occurred in
 * the Server Components render ». D'où un résultat, pas un `throw`.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** La trace telle qu'elle sort du worker, réduite à ce qui se stocke. */
export type ImportedTrack = {
  name: string | null;
  distanceM: number;
  ascentM: number;
  points: ResolvedPoint[];
  profile: ProfilePoint[];
};

/**
 * Un plan est un secret partagé : l'identifiant *est* le droit d'accès, il
 * n'y a pas de compte. Le vérifier avant la base évite qu'une saisie de
 * travers ressorte en `invalid input syntax for type uuid`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Écran 1 — le GPX vient d'être lu, on ouvre un plan et on le retient. */
export async function importTrack(
  track: ImportedTrack,
): Promise<Result<string>> {
  return guard(() =>
    createPlan({
      track: { ...track, name: track.name?.trim() || "Course sans nom" },
      settings: {},
      flasks: [],
      aidStations: [],
      legOverrides: [],
      productCodes: [],
    }),
  );
}

/**
 * Écran 1, l'autre porte — partir d'une course officielle.
 *
 * La copie s'ouvre sur la trace et les ravitos du modèle ; il ne reste que
 * le poids et les produits à saisir, le chrono étant demandé avant la copie.
 * Le modèle lui-même n'est jamais ouvert : le visiteur n'en connaît que le
 * `slug`.
 *
 * La copie n'a lieu qu'ici, une fois la fiche d'ouverture confirmée. Un clic
 * sur une carte ne crée plus rien : c'est un catalogue qu'on parcourt, et
 * chaque coup d'œil laissait jusqu'ici un plan derrière lui.
 */
export async function startOfficialRace(
  slug: string,
  { name, targetTimeS }: { name?: string; targetTimeS?: number } = {},
): Promise<Result<string>> {
  return guard(async () => {
    const planId = await officialRacePlanId(slug);
    if (!planId) throw new PlanError(`Unknown race: ${slug}`);

    // Un nom vidé n'efface pas celui du modèle : la copie le garde.
    return duplicatePlan(planId, {
      settings: { targetTimeS },
      name: name?.trim() || undefined,
    });
  });
}

/**
 * La trace d'une course officielle, pour la fiche d'ouverture.
 *
 * La fiche s'ouvre sans elle et la reçoit ensuite : c'est le seul endroit où
 * la géométrie d'un modèle traverse le réseau, et elle ne sert qu'à montrer
 * où l'on court. La copie, elle, se fait de ligne à ligne en base.
 */
export async function loadOfficialRaceTrack(
  slug: string,
): Promise<Result<ResolvedPoint[]>> {
  return guard(async () => {
    const points = await officialRacePoints(slug);
    if (!points) throw new PlanError(`Unknown race: ${slug}`);

    return points;
  });
}

/** Relit un plan — le retour sur un lien, ou un identifiant du navigateur. */
export async function loadPlan(accessId: string): Promise<Result<StoredPlan>> {
  return guard(async () => {
    const plan = await getPlan(accessId);
    if (!plan) throw new PlanError(`Unknown plan: ${accessId}`);

    return plan;
  }, accessId);
}

/**
 * Écrans 2 à 4 — ce que l'écran vient de changer, et rien d'autre.
 *
 * Rend le plan relu : la réponse porte déjà l'aller-retour, l'écran n'a pas
 * à en refaire un. Next sérialise les actions d'un même client, donc une
 * sauvegarde au fil de la frappe s'empile sans se doubler.
 */
export async function savePlan(
  accessId: string,
  patch: PlanPatch,
): Promise<Result<StoredPlan>> {
  return guard(async () => {
    await updatePlan(accessId, patch);
    const plan = await getPlan(accessId);
    if (!plan) throw new PlanError(`Unknown plan: ${accessId}`);

    return plan;
  }, accessId);
}

/** Écran 5 — calculer. Le plan doit avoir son poids et son chrono. */
export async function computePlan(accessId: string): Promise<Result<null>> {
  return guard(async () => {
    await regeneratePlan(accessId);

    return null;
  }, accessId);
}

/**
 * Écran 7 — imposer une durée ou une cible à un secteur.
 *
 * Une consigne change le découpage même du calcul : la mise à jour jette les
 * secteurs, le calcul doit repartir dans la foulée. Les deux dans une seule
 * transaction, pas seulement un seul aller-retour : une consigne qui rend le
 * plan infaisable ne doit pas s'enregistrer quand même, le roadbook effacé
 * derrière elle sans recours. Le refus défait tout, l'écran garde le
 * roadbook d'avant.
 */
export async function imposeOnLegs(
  accessId: string,
  legOverrides: LegOverride[],
): Promise<Result<null>> {
  return guard(async () => {
    await db.transaction(async (tx) => {
      await updatePlan(accessId, { legOverrides }, tx);
      await regeneratePlan(accessId, tx);
    });

    return null;
  }, accessId);
}

/**
 * Écran 7 — enregistrer les retouches. Le calcul se rejoue avec elles pour
 * consigne, donc les remarques ressortent justes.
 */
export async function saveEditedRoadbook(
  accessId: string,
  edit: RoadbookEdit,
): Promise<Result<null>> {
  return guard(async () => {
    await saveRoadbook(accessId, edit);

    return null;
  }, accessId);
}

/**
 * Le passage du serveur au client.
 *
 * Une action est une route POST ouverte à qui sait l'appeler : on ne laisse
 * sortir que le message d'un refus délibéré. Le reste est un bug — journalisé
 * ici, tu par là.
 */
async function guard<T>(
  run: () => Promise<T>,
  accessId?: string,
): Promise<Result<T>> {
  if (accessId !== undefined && !UUID.test(accessId)) {
    return { ok: false, error: `Unknown plan: ${accessId}` };
  }

  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof PlanError) return { ok: false, error: error.message };

    // Un plan dont le chrono ne tient plus (arrêts ou consignes imposées
    // au-delà de l'objectif) est un refus délibéré du noyau, pas un bug —
    // même s'il ne voyage pas en `PlanError`, faute de pouvoir porter ses
    // chiffres dans une classe qui vit côté serveur des plans.
    const issue = pacingIssue(error);
    if (issue) return { ok: false, error: pacingIssueText(issue) };

    console.error("action échouée", error);

    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}
