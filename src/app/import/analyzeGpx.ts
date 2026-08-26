import type { TrackAnalysis } from "@/core/type";
import type { GpxRequest, GpxResponse } from "./gpx.worker";

/**
 * Analyse un GPX hors du fil principal. Un worker par appel, terminé aussitôt
 * après : l'import est ponctuel, garder un fil en vie entre deux fichiers
 * coûterait de la mémoire sans rien faire gagner.
 */
export function analyzeGpx(xml: string): Promise<TrackAnalysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./gpx.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.addEventListener("message", (event: MessageEvent<GpxResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.analysis);
      else reject(new Error(event.data.error));
    });

    // Une erreur du worker lui-même — module introuvable, exception hors du
    // gestionnaire. Sans ce garde, la promesse ne se résoudrait jamais.
    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message || "Worker failed"));
    });

    worker.postMessage({ xml } satisfies GpxRequest);
  });
}
