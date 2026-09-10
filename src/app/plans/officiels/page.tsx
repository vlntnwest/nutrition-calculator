import Link from "next/link";
import { connection } from "next/server";
import { PlanCards } from "@/app/_home/PlanCards";
import { listOfficialRaces } from "@/app/plans/officialRaces";
import { ArrowLeftIcon } from "@/ui/icons";
import { EmptyNote } from "@/ui/Notice";

export const metadata = { title: "Plans officiels" };

/**
 * Le catalogue entier des courses officielles.
 *
 * L'accueil n'en montre que deux — c'est un écran d'import, les courses y
 * sont une porte de plus. Ici elles sont le sujet, donc `listOfficialRaces`
 * est appelée sans borne.
 *
 * Une grille plutôt que la ligne souple de l'accueil : `flex-1` étirerait la
 * carte esseulée d'une dernière rangée sur toute la largeur, ce qui va pour
 * deux cartes choisies et pas pour un catalogue de longueur inconnue.
 */
export default async function OfficialPlansPage() {
  // Sans cela, Next prérend la page au build : elle ne lit aucune API de
  // requête, donc il la fige à l'image de la base ce jour-là et une course
  // publiée ensuite n'y paraîtrait qu'au déploiement suivant. Même raison
  // que sur la page Catalogue.
  await connection();

  const races = await listOfficialRaces();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <Link
          href="/"
          className="-ml-1 mb-4 inline-flex items-center gap-2 text-[13px] text-ink-soft transition-colors hover:text-accent"
        >
          <ArrowLeftIcon className="size-4" />
          Retour à l'import
        </Link>

        <h1 className="font-semibold text-[22px] text-ink tracking-tight">
          Plans officiels
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Ouvrez une copie : la trace et les ravitos sont déjà posés, il ne
          reste que le chrono, le poids et les produits.
        </p>
      </header>

      {races.length === 0 ? (
        <EmptyNote titre="Aucune course publiée pour l'instant">
          Les courses officielles s'inscrivent depuis un plan existant. En
          attendant, l'import d'un GPX ouvre un plan vierge.
        </EmptyNote>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
            {races.length} course{races.length > 1 ? "s" : ""}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PlanCards races={races} />
          </div>
        </section>
      )}
    </main>
  );
}
