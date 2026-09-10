"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyzeGpx } from "@/app/import/analyzeGpx";
import { importTrack, savePlan } from "@/app/plans/actions";
import type { OfficialRace } from "@/app/plans/officialRaces";
import { rememberPlan } from "@/app/plans/stored";
import { Hero } from "./Hero";
import { ImportDropzone, type ImportStatus } from "./ImportDropzone";
import { ImportRaceModal, type ParsedTrack } from "./ImportRaceModal";
import { PlansActions } from "./nav/PlansActions";
import { PlanCards } from "./PlanCards";

/**
 * Écran d'import. Voir le commentaire de contrat de direction dans
 * layout.tsx pour la direction visuelle ; ce fichier orchestre seulement
 * la lecture du GPX et la création du plan, les autres pièces vivent
 * chacune dans leur fichier.
 *
 * Le catalogue arrive tout lu de `page.tsx` : la base ne se lit pas depuis
 * un composant client.
 */
export function HomeScreen({ races }: { races: OfficialRace[] }) {
  const [status, setStatus] = useState<ImportStatus>({ kind: "vide" });
  const [parsed, setParsed] = useState<ParsedTrack | null>(null);
  const router = useRouter();

  async function read(file: File) {
    setStatus({ kind: "lecture" });
    // L'extension sans égard à la casse : les exports d'ordinateur écrivent
    // parfois `.GPX`, et le sélecteur du téléphone rend le nom tel quel.
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setStatus({
        kind: "erreur",
        message: "Le fichier doit être un fichier GPX",
      });
      return;
    }

    // La lecture à part de l'analyse : sur un téléphone, le fichier choisi
    // dans un stockage en ligne n'est parfois qu'une référence que le
    // système n'arrive pas à livrer, et l'erreur du navigateur ne dit rien
    // de ce qu'il faut faire.
    let xml: string;

    try {
      xml = await file.text();
    } catch {
      setStatus({
        kind: "erreur",
        message:
          "Le fichier n'a pas pu être lu. S'il est rangé dans un stockage en ligne, téléchargez-le d'abord sur l'appareil.",
      });

      return;
    }

    if (xml.trim() === "") {
      setStatus({
        kind: "erreur",
        message:
          "Le fichier est arrivé vide. S'il est rangé dans un stockage en ligne, téléchargez-le d'abord sur l'appareil.",
      });

      return;
    }

    try {
      const analysis = await analyzeGpx(xml);
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
    if (!parsed) return "Le fichier importé a été perdu. Relancez l'import.";

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
              <PlanCards races={races} />
            </div>
            <PlansActions />
          </div>
        </div>
      </Hero>

      {parsed && (
        <ImportRaceModal
          source={{ kind: "gpx", track: parsed }}
          onCancel={() => setParsed(null)}
          onConfirm={confirm}
        />
      )}
    </main>
  );
}
