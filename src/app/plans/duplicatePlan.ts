import { eq, getTableColumns, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { db } from "@/db";
import { aidStations } from "@/db/schema/aidStations";
import { planSettings } from "@/db/schema/planSettings";
import { plans } from "@/db/schema/plans";
import { tracks } from "@/db/schema/tracks";
import { PlanError } from "./planError";
import type { NewPlan } from "./planInput";
import { settingsColumns } from "./planInput";

/**
 * Ouvre un plan neuf sur la trace et les ravitos d'un autre.
 *
 * Ce qui se copie s'arrête là : réglages, flasques, consignes et produits
 * repartent à vide. Un modèle prête son parcours, pas le chrono ni le poids
 * de qui l'a posé — et un roadbook n'a rien à copier, il se calcule.
 *
 * `settings` et `name` sont ce que la fiche d'ouverture a demandé avant la
 * copie : le chrono visé, et le nom si le coureur l'a changé. Ils s'écrivent
 * dans les insertions plutôt qu'en mise à jour derrière — un plan neuf n'a
 * rien à fusionner, et la copie sort de sa transaction déjà complète.
 *
 * La géométrie ne remonte pas dans Node : un `insert … select` la recopie de
 * ligne à ligne, là où la relire pour la réécrire coûterait le mégaoctet et
 * demi d'une trace de cent soixante-seize kilomètres à chaque clic.
 */
export async function duplicatePlan(
  sourceId: string,
  {
    settings = {},
    name,
  }: { settings?: NewPlan["settings"]; name?: string } = {},
): Promise<string> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select({ accessId: plans.accessId })
      .from(plans)
      .where(eq(plans.accessId, sourceId));

    if (!source) throw new PlanError(`Unknown plan: ${sourceId}`);

    // La copie porte les six mois de tout le monde, même tirée d'un modèle
    // qui, lui, ne périme pas : le défaut de la colonne s'en charge.
    const [plan] = await tx
      .insert(plans)
      .values({})
      .returning({ accessId: plans.accessId });

    await copyTrack(tx, sourceId, plan.accessId, name);

    await tx
      .insert(planSettings)
      .values({ planId: plan.accessId, ...settingsColumns(settings) });

    const aids = await tx
      .select()
      .from(aidStations)
      .where(eq(aidStations.planId, sourceId));

    if (aids.length > 0) {
      await tx
        .insert(aidStations)
        .values(aids.map((aid) => ({ ...aid, planId: plan.accessId })));
    }

    return plan.accessId;
  });
}

/**
 * Recopie la trace en base, sans la faire transiter par l'application.
 *
 * Les colonnes se lisent du schéma : celle qui s'y ajoutera demain suivra
 * d'elle-même, sauf `plan_id`, qui change, `imported_at`, qui date la copie
 * et non l'import d'origine, et `name`, que la fiche d'ouverture peut avoir
 * réécrit. Le `coalesce` garde le nom du modèle quand elle n'y a pas touché.
 */
async function copyTrack(
  tx: Tx,
  sourceId: string,
  planId: string,
  name?: string,
) {
  const {
    planId: _cible,
    importedAt: _date,
    name: _nom,
    ...copiees
  } = getTableColumns(tracks);
  const colonnes = sql.raw(
    Object.values(copiees)
      .map((colonne) => `"${colonne.name}"`)
      .join(", "),
  );

  await tx.execute(sql`
    insert into ${tracks} ("plan_id", "name", ${colonnes})
    select ${planId}::uuid, coalesce(${name ?? null}::text, ${tracks.name}), ${colonnes}
    from ${tracks}
    where ${tracks.planId} = ${sourceId}::uuid
  `);
}
