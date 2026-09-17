import { renderToBuffer } from "@react-pdf/renderer";
import {
  planOf,
  roadbookOf,
  trackPointsOf,
  trackProfileOf,
} from "@/app/plan/[accessId]/plan";
import { resolveTargets } from "@/app/plans/targets";
import { SheetDocument } from "@/pdf/SheetDocument";
import { fileNameOf, sheetOf } from "@/pdf/sheet";
import { carteOf } from "@/pdf/sheetMapData";
import { profilOf } from "@/pdf/sheetProfileData";

/**
 * La feuille à emporter. Elle se fabrique ici et non dans le navigateur : le
 * profil pleine résolution dont dépend la bande d'allure est lu en base et
 * consommé sur place, sans traverser le réseau. Voir `docs/pdf-du-roadbook.md`.
 *
 * Un fichier `route` n'accepte que `.js` et `.ts` : pas de JSX ici. Le
 * document vit à côté, et s'appelle comme la fonction qu'il est — ce qu'il
 * rend est déjà l'élément que `renderToBuffer` attend.
 *
 * Ce qui sort est l'état **enregistré**, jamais les retouches en cours : la
 * base est la seule source, et l'écran rend son bouton inerte tant qu'il
 * porte des retouches. Voir la section 2.2 du document.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/plan/[accessId]/roadbook/pdf">,
) {
  const { accessId } = await ctx.params;
  const [plan, roadbook] = await Promise.all([
    planOf(accessId),
    roadbookOf(accessId),
  ]);

  // Deux 404 qui ne disent pas la même chose : un identifiant de travers ou un
  // plan expiré n'a pas de roadbook à ouvrir, et envoyer son lecteur en
  // lancer le calcul serait l'envoyer nulle part.
  if (!plan) {
    return new Response("Plan introuvable, ou expiré.", { status: 404 });
  }

  // Un plan jamais calculé n'a pas de feuille : il n'a ni secteur, ni ration.
  if (!roadbook) {
    return new Response(
      "Ce plan n'a pas encore été calculé. Ouvrez son roadbook et lancez le calcul.",
      { status: 404 },
    );
  }

  // La même décision que le calcul et que l'écran : l'écart montré doit
  // porter sur ce qui a réellement été visé.
  const cibles = resolveTargets(
    {
      targetCarbsGH: plan.settings.targets?.carbsGH ?? null,
      targetFluidMlH: plan.settings.targets?.fluidMlH ?? null,
      targetSodiumMgL: plan.settings.targets?.sodiumMgL ?? null,
    },
    { massKg: plan.settings.massKg ?? 70, flasks: plan.flasks },
    plan.settings.targetTimeS ?? 0,
  );

  const feuille = sheetOf(plan, roadbook, cibles);

  // La géométrie ne sert qu'à dessiner : elle se lit après la sortie du plan
  // non calculé, qui n'a rien à tracer. Le profil pleine résolution ne
  // traverse pas le réseau, c'est toute la raison d'être ici (2.1).
  const [points, profile] = await Promise.all([
    trackPointsOf(accessId),
    trackProfileOf(accessId),
  ]);
  const carte = await carteOf(plan, points);
  const profil =
    points.length < 2
      ? null
      : profilOf({
          plan,
          roadbook,
          points,
          profile,
          // La figure se calcule dans un cadre à elle, que la `viewBox`
          // ramène ensuite à la place qu'elle occupe sur le papier.
          cadre: { largeur: 1000, hauteur: 300 },
        });

  const buffer = await renderToBuffer(
    SheetDocument({ feuille, carte, profil }),
  );
  const nom = fileNameOf(plan.track.name, plan.settings.raceDate);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}
