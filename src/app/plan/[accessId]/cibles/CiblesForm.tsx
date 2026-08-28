"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePlan } from "@/app/plans/actions";
import type { Flask, Targets } from "@/core/type";
import { nombre } from "../champs";

type Champs = { carbsGH: string; fluidMlH: string; sodiumMgL: string };
type LigneFlasque = { volumeMl: string; onlyWater: boolean };

const enChamps = (t: Targets): Champs => ({
  carbsGH: String(t.carbsGH),
  fluidMlH: String(t.fluidMlH),
  sodiumMgL: String(t.sodiumMgL),
});

export function CiblesForm({
  accessId,
  targets,
  suggestion,
  flasks,
}: {
  accessId: string;
  targets: Targets | undefined;
  /** Nul tant qu'on ignore le poids ou le chrono. */
  suggestion: Targets | null;
  flasks: Flask[];
}) {
  const depart = targets ?? suggestion;
  const [champs, setChamps] = useState<Champs>(
    depart ? enChamps(depart) : { carbsGH: "", fluidMlH: "", sodiumMgL: "" },
  );
  const [lignes, setLignes] = useState<LigneFlasque[]>(
    flasks.map((f) => ({
      volumeMl: String(f.volumeMl),
      onlyWater: f.onlyWater,
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // Ce qui est montré n'a pas encore été validé : tant que l'utilisateur n'a
  // pas enregistré, ce sont les valeurs du noyau, pas les siennes.
  const propose = targets === undefined && suggestion !== null;

  function submit() {
    // Trois constantes, pas un objet : contrôler `o.x` ne restreint pas le
    // type de `o`, seulement celui de `o.x` là où on le lit.
    const carbsGH = nombre(champs.carbsGH);
    const fluidMlH = nombre(champs.fluidMlH);
    const sodiumMgL = nombre(champs.sodiumMgL);

    if (
      carbsGH === undefined ||
      fluidMlH === undefined ||
      sodiumMgL === undefined
    ) {
      setMessage("Les trois cibles sont nécessaires.");

      return;
    }

    const volumes: Flask[] = [];
    for (const ligne of lignes) {
      const volumeMl = nombre(ligne.volumeMl);
      if (volumeMl === undefined) {
        setMessage("Indique la contenance de chaque flasque, en millilitres.");

        return;
      }
      volumes.push({ volumeMl, onlyWater: ligne.onlyWater });
    }

    setMessage(null);
    start(async () => {
      const result = await savePlan(accessId, {
        settings: { targets: { carbsGH, fluidMlH, sodiumMgL } },
        flasks: volumes,
      });
      setMessage(result.ok ? "Enregistré." : result.error);
      // Les props viennent du serveur : sans ce rendu, l'écran continuerait
      // d'annoncer l'état d'avant l'enregistrement.
      if (result.ok) router.refresh();
    });
  }

  function edit(i: number, patch: Partial<LigneFlasque>) {
    setLignes(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Cibles horaires</h2>

        {propose && (
          <p className="text-sm">
            Valeurs suggérées pour ton poids et ton chrono. Enregistre pour les
            retenir, ou change-les.
          </p>
        )}
        {depart === null && (
          <p className="text-sm">
            Renseigne d'abord ton poids et ton chrono dans l'onglet Course : la
            suggestion en dépend.
          </p>
        )}

        <div className="flex gap-6">
          {(
            [
              ["carbsGH", "Glucides (g/h)"],
              ["fluidMlH", "Liquide (ml/h)"],
              ["sodiumMgL", "Sodium (mg/L)"],
            ] as const
          ).map(([cle, libelle]) => (
            <label key={cle} className="flex flex-col gap-1">
              <span className="text-sm">{libelle}</span>
              <input
                className="w-28 border px-2 py-1"
                inputMode="decimal"
                value={champs[cle]}
                onChange={(e) =>
                  setChamps({ ...champs, [cle]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Flasques</h2>
        <p className="text-sm">
          Ce qu'on porte. Sans flasque, le roadbook ne dit pas où verser la
          boisson.
        </p>

        {lignes.map((ligne, i) => (
          // Une flasque n'a que son rang pour identité, et il change quand on
          // en retire une.
          // biome-ignore lint/suspicious/noArrayIndexKey: le rang est l'identité
          <div key={i} className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Contenance (ml)</span>
              <input
                className="w-28 border px-2 py-1"
                inputMode="decimal"
                placeholder="500"
                value={ligne.volumeMl}
                onChange={(e) => edit(i, { volumeMl: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={ligne.onlyWater}
                onChange={(e) => edit(i, { onlyWater: e.target.checked })}
              />
              <span className="text-sm">Eau claire seulement</span>
            </label>
            <button
              type="button"
              className="border px-2 py-1"
              onClick={() => setLignes(lignes.filter((_, j) => j !== i))}
            >
              Retirer
            </button>
          </div>
        ))}

        <button
          type="button"
          className="self-start border px-2 py-1"
          onClick={() =>
            setLignes([...lignes, { volumeMl: "500", onlyWater: false }])
          }
        >
          Ajouter une flasque
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="border px-3 py-1 font-semibold"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message && <output>{message}</output>}
      </div>
    </section>
  );
}
