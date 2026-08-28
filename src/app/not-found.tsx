import Link from "next/link";

/**
 * Un plan tient six mois après la course, puis disparaît — §11. Passé ce
 * délai le lien ne mène plus nulle part, et rien ne le distingue d'un
 * identifiant inventé.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Ce plan n'existe pas</h1>
      <p>
        Le lien est peut-être erroné, ou le plan a expiré : un plan se garde six
        mois après la course.
      </p>
      <Link href="/" className="underline">
        Importer une trace
      </Link>
    </main>
  );
}
