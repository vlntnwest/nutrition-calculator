"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyzeGpx } from "./import/analyzeGpx";
import { importTrack } from "./plans/actions";
import { rememberPlan } from "./plans/stored";

type State =
  | { kind: "vide" }
  | { kind: "lecture" }
  | { kind: "erreur"; message: string };

/**
 * Écran d'import, réduit à son squelette : il n'y a pas encore de direction
 * artistique. Le GPX est lu dans un worker, puis le plan s'ouvre en base
 * aussitôt — l'identifiant rendu est tout ce qui rouvre le plan ensuite.
 */
export default function Page() {
  const [state, setState] = useState<State>({ kind: "vide" });
  const router = useRouter();

  async function read(file: File) {
    setState({ kind: "lecture" });
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
      // L'état reste sur « lecture » : la navigation remplace l'écran, et
      // repasser par « vide » ferait clignoter le formulaire au départ.
      router.push(`/plan/${created.value}`);
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
    </main>
  );
}
