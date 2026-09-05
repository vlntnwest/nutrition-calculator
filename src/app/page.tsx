"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoCards } from "./_home/cards/DemoCards";
import {
  ImportDropzone,
  type ImportStatus,
} from "./_home/dropzone/ImportDropzone";
import { Hero } from "../components/Hero";
import { PlansActions } from "./_home/nav/PlansActions";
import { analyzeGpx } from "./import/analyzeGpx";
import { importTrack } from "./plans/actions";
import { rememberPlan } from "./plans/stored";

/**
 * Écran d'import. Voir le commentaire de contrat de direction dans
 * layout.tsx pour la direction visuelle ; ce fichier orchestre seulement
 * la lecture du GPX, les autres pièces vivent chacune dans leur fichier.
 */
export default function Page() {
  const [status, setStatus] = useState<ImportStatus>({ kind: "vide" });
  const router = useRouter();

  async function read(file: File) {
    setStatus({ kind: "lecture" });
    try {
      const analysis = await analyzeGpx(await file.text());
      const created = await importTrack({
        name: analysis.name,
        distanceM: analysis.distanceM,
        ascentM: Math.round(analysis.ascentM),
        points: analysis.points,
        profile: analysis.profile,
      });

      if (!created.ok) {
        setStatus({ kind: "erreur", message: created.error });

        return;
      }

      rememberPlan(created.value);
      // L'état reste sur « lecture » : la navigation remplace l'écran, et
      // repasser par « vide » ferait clignoter le formulaire au départ.
      router.push(`/plan/${created.value}/pace`);
    } catch (error) {
      setStatus({
        kind: "erreur",
        message: error instanceof Error ? error.message : String(error),
      });
    }
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
    </main>
  );
}
