"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hero } from "../components/Hero";
import { DemoCards } from "./_home/cards/DemoCards";
import {
  ImportDropzone,
  type ImportStatus,
} from "./_home/dropzone/ImportDropzone";
import {
  ImportRaceModal,
  type ParsedTrack,
} from "./_home/import-modal/ImportRaceModal";
import { PlansActions } from "./_home/nav/PlansActions";
import { analyzeGpx } from "./import/analyzeGpx";
import { importTrack, savePlan } from "./plans/actions";
import { rememberPlan } from "./plans/stored";

/**
 * Écran d'import. Voir le commentaire de contrat de direction dans
 * layout.tsx pour la direction visuelle ; ce fichier orchestre seulement
 * la lecture du GPX et la création du plan, les autres pièces vivent
 * chacune dans leur fichier.
 */
export default function Page() {
  const [status, setStatus] = useState<ImportStatus>({ kind: "vide" });
  const [parsed, setParsed] = useState<ParsedTrack | null>(null);
  const router = useRouter();

  async function read(file: File) {
    setStatus({ kind: "lecture" });
    if (!file.name.endsWith(".gpx")) {
      setStatus({
        kind: "erreur",
        message: "Le fichier doit être un fichier GPX",
      });
      return;
    }
    try {
      const analysis = await analyzeGpx(await file.text());
      setStatus({ kind: "vide" });
      setParsed({
        fileName: file.name,
        name: analysis.name,
        distanceM: analysis.distanceM,
        ascentM: analysis.ascentM,
        points: analysis.points,
        profile: analysis.profile,
      });
    } catch (error) {
      setStatus({
        kind: "erreur",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * La modale valide le nom et le chrono ; le plan n'existe qu'à partir
   * d'ici. Un message renvoyé rouvre la modale dessus, `null` déclenche la
   * navigation vers l'onglet Course pour y poser les ravitos.
   */
  async function confirm(
    raceName: string,
    targetTimeS: number | undefined,
  ): Promise<string | null> {
    if (!parsed) return "Le fichier importé a été perdu — réessayez.";

    const created = await importTrack({
      name: raceName,
      distanceM: parsed.distanceM,
      ascentM: Math.round(parsed.ascentM),
      points: parsed.points,
      profile: parsed.profile,
    });

    if (!created.ok) return created.error;

    if (targetTimeS !== undefined) {
      const saved = await savePlan(created.value, {
        settings: { targetTimeS },
      });
      if (!saved.ok) return saved.error;
    }

    rememberPlan(created.value);
    router.push(`/plan/${created.value}`);

    return null;
  }

  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      <Hero>
        <div className="px-6 pt-4 text-center sm:pt-8 lg:pt-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Importez la trace de votre course
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink-soft sm:text-lg">
            Un fichier GPX suffit. Le plan s'ouvre aussitôt et se garde sur cet
            appareil.
          </p>
        </div>
        <ImportDropzone status={status} onFile={(file) => void read(file)} />

        <div className="flex flex-1 w-full px-4 pb-6 lg:pb-8">
          <div className="flex w-full flex-col gap-4 pt-16 lg:flex-row">
            <div className="flex flex-1 flex-wrap gap-4">
              <DemoCards />
            </div>
            <PlansActions />
          </div>
        </div>
      </Hero>

      {parsed && (
        <ImportRaceModal
          track={parsed}
          onCancel={() => setParsed(null)}
          onConfirm={confirm}
        />
      )}
    </main>
  );
}
