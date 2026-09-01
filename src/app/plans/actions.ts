"use server";

import type { ProfilePoint, ResolvedPoint } from "@/core/type";
import { createPlan } from "./createPlan";
import { getPlan } from "./getPlan";
import { PlanError } from "./planError";
import type { NewPlan } from "./planInput";
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

/** Relit un plan — le retour sur un lien, ou un identifiant du navigateur. */
export async function loadPlan(accessId: string): Promise<Result<NewPlan>> {
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
): Promise<Result<NewPlan>> {
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
 * Écran 5 — enregistrer les retouches. Le calcul se rejoue avec elles pour
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

    console.error("action échouée", error);

    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}
