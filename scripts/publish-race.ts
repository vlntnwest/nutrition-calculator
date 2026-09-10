/**
 * Publie un plan à l'accueil, comme course officielle.
 *
 *   npm run race:publish -- <accessId> --slug traversee-des-cimes-2026 \
 *     --photo /card-modele.webp [--rank 0]
 *
 * Le modèle se fabrique avec les écrans — on importe le GPX, on pose les
 * ravitos — puis on l'inscrit ici. Publier fait deux choses : le plan cesse
 * de périmer, et sa vignette de profil est calculée une fois pour toutes.
 * Republier après avoir corrigé la trace la recalcule.
 */
import { eq, sql } from "drizzle-orm";
import type { ProfilePoint } from "@/core/type";
import { db } from "@/db";
import { officialRaces } from "@/db/schema/officialRaces";
import { plans } from "@/db/schema/plans";
import { tracks } from "@/db/schema/tracks";

const VIEWBOX = { width: 400, height: 160, marge: 6 };
const POINTS = 64;

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);

  return i === -1 ? undefined : process.argv[i + 1];
}

/**
 * Le profil réduit à une silhouette, en coordonnées de la carte.
 *
 * Relire dix mille points pour dessiner huit centimètres de tracé n'a pas de
 * sens : on en garde soixante-quatre, régulièrement espacés en distance, et
 * l'altitude s'étale sur toute la hauteur — la carte montre le relief, elle
 * ne le mesure pas.
 */
function silhouette(profile: ProfilePoint[]): string {
  const eles = profile.map((p) => p.ele);
  const bas = Math.min(...eles);
  const haut = Math.max(...eles);
  const amplitude = haut - bas || 1;
  const dernier = profile[profile.length - 1].d || 1;
  const utile = VIEWBOX.height - 2 * VIEWBOX.marge;

  const echantillons =
    profile.length <= POINTS
      ? profile
      : Array.from({ length: POINTS }, (_, i) => {
          const rang = Math.round((i * (profile.length - 1)) / (POINTS - 1));

          return profile[rang];
        });

  return echantillons
    .map((point, i) => {
      const x = (point.d / dernier) * VIEWBOX.width;
      const y = VIEWBOX.marge + utile - ((point.ele - bas) / amplitude) * utile;

      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

async function main() {
  const accessId = process.argv[2];
  const slug = option("slug");
  const photoPath = option("photo");
  const rank = Number(option("rank") ?? 0);

  if (!accessId || !slug || !photoPath) {
    console.error(
      "Usage : npm run race:publish -- <accessId> --slug <slug> --photo <chemin> [--rank <n>]",
    );
    process.exit(1);
  }

  const [track] = await db
    .select({ name: tracks.name, profile: tracks.profile })
    .from(tracks)
    .where(eq(tracks.planId, accessId));

  if (!track) {
    console.error(`Plan introuvable : ${accessId}`);
    process.exit(1);
  }

  const profilePath = silhouette(track.profile);

  await db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ expiresAt: sql`null` })
      .where(eq(plans.accessId, accessId));

    const values = { slug, planId: accessId, photoPath, profilePath, rank };

    await tx
      .insert(officialRaces)
      .values(values)
      .onConflictDoUpdate({ target: officialRaces.slug, set: values });
  });

  console.log(`« ${track.name} » publiée sous /${slug}.`);
  process.exit(0);
}

main();
