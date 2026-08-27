"use client";

import { useState, useTransition } from "react";
import { savePlan } from "@/app/plans/actions";
import type { NewAidStation, NewPlan } from "@/app/plans/planInput";

/** `13500` → `03:45`. Ce que l'écran montre, pas ce que la base garde. */
function toClock(seconds: number | undefined): string {
  if (seconds === undefined) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `03:45` → `13500`. Rend `undefined` sur une saisie inexploitable. */
function toSeconds(clock: string): number | undefined {
  const [h, m] = clock.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;

  return h * 3600 + m * 60;
}

const nombre = (v: string): number | undefined =>
  v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v);

export function CourseForm({
  accessId,
  plan,
}: {
  accessId: string;
  plan: NewPlan;
}) {
  const [chrono, setChrono] = useState(toClock(plan.settings.targetTimeS));
  const [masse, setMasse] = useState(String(plan.settings.massKg ?? ""));
  const [stations, setStations] = useState<NewAidStation[]>(plan.aidStations);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMessage(null);
    start(async () => {
      const result = await savePlan(accessId, {
        settings: { targetTimeS: toSeconds(chrono), massKg: nombre(masse) },
        aidStations: stations,
      });
      setMessage(result.ok ? "Enregistré." : result.error);
    });
  }

  function edit(i: number, patch: Partial<NewAidStation>) {
    setStations(stations.map((s, j) => (j === i ? { ...s, ...patch } : s)));
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

        {stations.length === 0 && (
          <p className="text-sm">Aucun pour l'instant.</p>
        )}

        {stations.map((station, i) => (
          // Rien d'unique et de stable à quoi s'accrocher : deux ravitos
          // peuvent partager un nom, et leur position change en cours de saisie.
          // biome-ignore lint/suspicious/noArrayIndexKey: le rang est l'identité
          <div key={i} className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Nom</span>
              <input
                className="border px-2 py-1"
                value={station.name}
                onChange={(e) => edit(i, { name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">km</span>
              <input
                className="w-20 border px-2 py-1"
                value={station.distanceM / 1000}
                onChange={(e) =>
                  edit(i, { distanceM: (nombre(e.target.value) ?? 0) * 1000 })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Arrêt (min)</span>
              <input
                className="w-24 border px-2 py-1"
                value={station.stopS === undefined ? "" : station.stopS / 60}
                onChange={(e) => {
                  const min = nombre(e.target.value);
                  edit(i, { stopS: min === undefined ? undefined : min * 60 });
                }}
              />
            </label>
            <button
              type="button"
              className="border px-2 py-1"
              onClick={() => setStations(stations.filter((_, j) => j !== i))}
            >
              Retirer
            </button>
          </div>
        ))}

        <button
          type="button"
          className="self-start border px-2 py-1"
          onClick={() =>
            setStations([
              ...stations,
              { name: `Ravito ${stations.length + 1}`, distanceM: 0 },
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
