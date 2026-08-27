"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePlan } from "@/app/plans/actions";
import type { CatalogueEntry } from "@/app/plans/catalogue";

export function ProduitsForm({
  accessId,
  catalogue,
  choisis,
}: {
  accessId: string;
  catalogue: CatalogueEntry[];
  choisis: string[];
}) {
  const [retenus, setRetenus] = useState(new Set(choisis));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(code: string) {
    const suite = new Set(retenus);
    if (!suite.delete(code)) suite.add(code);
    setRetenus(suite);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold">Produits</h2>

      <ul className="flex flex-col gap-1">
        {catalogue.map((produit) => (
          <li key={produit.codeSeed}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={retenus.has(produit.codeSeed)}
                onChange={() => toggle(produit.codeSeed)}
              />
              <span>
                {produit.brandName} {produit.name}
              </span>
              <span className="text-sm">
                ({produit.formatLabel} · {produit.carbsG} g · {produit.sodiumMg}{" "}
                mg)
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="self-start border px-3 py-1 font-semibold"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await savePlan(accessId, {
                productCodes: [...retenus],
              });
              setMessage(result.ok ? "Enregistré." : result.error);
              // Les props viennent du serveur : sans ce rendu, l'écran continuerait
              // d'annoncer l'état d'avant l'enregistrement.
              if (result.ok) router.refresh();
            });
          }}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message && <output>{message}</output>}
      </div>
    </section>
  );
}
