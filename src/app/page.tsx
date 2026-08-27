"use client";

import { useState } from "react";
import type { TrackAnalysis } from "@/core/type";
import { analyzeGpx } from "./import/analyzeGpx";
import { importTrack } from "./plans/actions";
import { rememberPlan } from "./plans/stored";

type State =
  | { kind: "vide" }
  | { kind: "lecture" }
  | { kind: "ouvert"; analysis: TrackAnalysis; accessId: string; ms: number }
  | { kind: "erreur"; message: string };

/**
 * Écran d'import, réduit à son squelette : il n'y a pas encore de direction
 * artistique. Le GPX est lu dans un worker, puis le plan s'ouvre en base
 * aussitôt — l'identifiant rendu est tout ce qui rouvre le plan ensuite.
 */
export default function Page() {
  const [state, setState] = useState<State>({ kind: "vide" });

  async function read(file: File) {
    setState({ kind: "lecture" });
    const started = performance.now();
    try {
      const analysis = await analyzeGpx(await file.text());
      const created = await importTrack({
        name: analysis.name,
        distanceM: analysis.distanceM,
        ascentM: Math.round(analysis.ascentM),
        points: analysis.points,
      });

      if (!created.ok) {
        setState({ kind: "erreur", message: created.error });

        return;
      }

      rememberPlan(created.value);
      setState({
        kind: "ouvert",
        analysis,
        accessId: created.value,
        ms: performance.now() - started,
      });
    } catch (error) {
      setState({
        kind: "erreur",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Plan nutritionnel de course</h1>

      <label className="flex flex-col gap-2">
        <span>Fichier GPX</span>
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void read(file);
          }}
        />
      </label>

      {state.kind === "lecture" && <p>Lecture…</p>}

      {state.kind === "erreur" && (
        <p role="alert">Import impossible — {state.message}</p>
      )}

      {state.kind === "ouvert" && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          <dt>Plan</dt>
          <dd data-testid="access-id">{state.accessId}</dd>
          <dt>Nom</dt>
          <dd>{state.analysis.name ?? "sans nom"}</dd>
          <dt>Distance</dt>
          <dd>{(state.analysis.distanceM / 1000).toFixed(1)} km</dd>
          <dt>Dénivelé positif</dt>
          <dd>{Math.round(state.analysis.ascentM)} m</dd>
          <dt>Points bruts</dt>
          <dd>{state.analysis.rawPoints}</dd>
          <dt>Points conservés</dt>
          <dd>{state.analysis.points.length}</dd>
          <dt>Tronçons</dt>
          <dd>{state.analysis.segments.length}</dd>
          <dt>Import et écriture</dt>
          <dd>{Math.round(state.ms)} ms</dd>
        </dl>
      )}
    </main>
  );
}
