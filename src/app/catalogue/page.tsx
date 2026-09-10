import { connection } from "next/server";
import { listProducts } from "@/app/plans/catalogue";
import { entier, quantite } from "@/format/number";
import { NewProductForm } from "./NewProductForm";

export const metadata = { title: "Catalogue — nouveau produit" };

/**
 * Un outil, pas un écran de course : saisie brute en base, marque et format
 * tels que le noyau les nomme, sans la traduction que `formatFr` réserve au
 * coureur.
 */
export default async function CataloguePage() {
  // Sans cela, Next prérend la page au build : elle ne lit aucune API de
  // requête, donc il la croit identique pour tout le monde et la fige à
  // l'image de la base ce jour-là. Un produit ajouté ensuite n'y paraissait
  // qu'au déploiement suivant, tout en s'affichant partout ailleurs.
  await connection();

  const catalogue = await listProducts();
  const marques = [...new Set(catalogue.map((p) => p.brandName))].sort();
  const formats = [...new Set(catalogue.map((p) => p.formatLabel))].sort();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-semibold text-[22px] text-ink tracking-tight">
          Catalogue
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Ajouter un produit, tel qu'il est nommé en base.
        </p>
      </header>

      <NewProductForm marques={marques} formats={formats} />

      <section className="flex flex-col gap-3">
        <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
          {catalogue.length} produit{catalogue.length > 1 ? "s" : ""}
        </p>

        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-line border-b bg-paper-dim text-[11px] text-ink-soft uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Marque</th>
                <th className="px-3 py-2 font-medium">Format</th>
                <th className="px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Identifiant</th>
                <th className="px-3 py-2 text-right font-medium">Glucides</th>
                <th className="px-3 py-2 text-right font-medium">Sodium</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.map((p) => (
                <tr
                  key={p.codeSeed}
                  className="border-line border-b last:border-0"
                >
                  <td className="px-3 py-2 text-ink">{p.brandName}</td>
                  <td className="px-3 py-2 font-mono text-ink-soft">
                    {p.formatLabel}
                  </td>
                  <td className="px-3 py-2 text-ink">{p.name}</td>
                  <td className="px-3 py-2 font-mono text-ink-faint">
                    {p.codeSeed}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {quantite(p.carbsG)} g
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink">
                    {entier(p.sodiumMg)} mg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
