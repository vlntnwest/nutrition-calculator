import Link from "next/link";
import { ArrowLeftIcon } from "@/ui/icons";
import { StoredPlansTable } from "./StoredPlansTable";

export const metadata = { title: "Mes plans" };

/**
 * Les plans ouverts depuis cet appareil.
 *
 * La page ne lit rien : la liste vit dans le navigateur, et c'est le tableau
 * qui va chercher le relevé de chaque plan une fois monté. Rien à prérendre
 * ici qui dépende de la base, donc rien à rendre dynamique non plus.
 */
export default function MyPlansPage() {
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
          Mes plans
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Gardés par ce navigateur, et par lui seul. Vider ses données efface la
          liste, pas les plans : le lien d'un plan reste la seule façon d'y
          revenir depuis un autre appareil.
        </p>
      </header>

      <StoredPlansTable />
    </main>
  );
}
