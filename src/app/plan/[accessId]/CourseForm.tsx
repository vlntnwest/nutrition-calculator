"use client";

import { useState, useTransition } from "react";
import { savePlan } from "@/app/plans/actions";
import type { NewAidStation, NewPlan } from "@/app/plans/planInput";
import { nombre, toClock, toSeconds } from "./champs";

/**
 * Un ravito en cours de saisie.
 *
 * Le texte tapé, pas la valeur : repasser par un nombre à chaque frappe
 * effacerait le séparateur décimal, qu'on ne pourrait alors jamais entrer.
 * La conversion attend l'enregistrement.
 */
type Ligne = { name: string; km: string; stopMin: string };

function toLigne(aid: NewAidStation): Ligne {
  return {
    name: aid.name,
    km: String(aid.distanceM / 1000),
    stopMin: aid.stopS === undefined ? "" : String(aid.stopS / 60),
  };
}

/** Les ravitos saisis, ou le premier reproche à faire à l'utilisateur. */
function toStations(lignes: Ligne[]): NewAidStation[] | string {
  const stations: NewAidStation[] = [];

  for (const ligne of lignes) {
    const km = nombre(ligne.km);
    if (km === undefined) {
      return `Ravito « ${ligne.name} » : indique sa distance en kilomètres.`;
    }

    const stop = nombre(ligne.stopMin);
    if (ligne.stopMin.trim() !== "" && stop === undefined) {
      return `Ravito « ${ligne.name} » : l'arrêt n'est pas un nombre de minutes.`;
    }

    stations.push({
      name: ligne.name,
      distanceM: km * 1000,
      stopS: stop === undefined ? undefined : stop * 60,
    });
  }

  return stations;
}

export function CourseForm({
  accessId,
  plan,
}: {
  accessId: string;
  plan: NewPlan;
}) {
  const [chrono, setChrono] = useState(toClock(plan.settings.targetTimeS));
  const [masse, setMasse] = useState(String(plan.settings.massKg ?? ""));
  const [lignes, setLignes] = useState<Ligne[]>(plan.aidStations.map(toLigne));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const stations = toStations(lignes);
    if (typeof stations === "string") {
      setMessage(stations);

      return;
    }

    setMessage(null);
    start(async () => {
      const result = await savePlan(accessId, {
        settings: { targetTimeS: toSeconds(chrono), massKg: nombre(masse) },
        aidStations: stations,
      });
      setMessage(result.ok ? "Enregistré." : result.error);
    });
  }

  function edit(i: number, patch: Partial<Ligne>) {
    setLignes(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex gap-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Chrono visé (hh:mm)</span>
          <input
            className="border px-2 py-1"
            value={chrono}
            placeholder="03:45"
            onChange={(e) => setChrono(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Poids (kg)</span>
          <input
            className="border px-2 py-1"
            value={masse}
            placeholder="70"
            onChange={(e) => setMasse(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Ravitaillements</h2>

        {lignes.length === 0 && (
          <p className="text-sm">Aucun pour l'instant.</p>
        )}

        {lignes.map((ligne, i) => (
          // Rien d'unique et de stable à quoi s'accrocher : deux ravitos
          // peuvent partager un nom, et leur position change en cours de saisie.
          // biome-ignore lint/suspicious/noArrayIndexKey: le rang est l'identité
          <div key={i} className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Nom</span>
              <input
                className="border px-2 py-1"
                value={ligne.name}
                onChange={(e) => edit(i, { name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">km</span>
              <input
                className="w-20 border px-2 py-1"
                inputMode="decimal"
                value={ligne.km}
                placeholder="9,8"
                onChange={(e) => edit(i, { km: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Arrêt (min)</span>
              <input
                className="w-24 border px-2 py-1"
                inputMode="decimal"
                value={ligne.stopMin}
                onChange={(e) => edit(i, { stopMin: e.target.value })}
              />
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
            setLignes([
              ...lignes,
              { name: `Ravito ${lignes.length + 1}`, km: "", stopMin: "" },
            ])
          }
        >
          Ajouter un ravito
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
