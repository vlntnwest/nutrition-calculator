/// <reference lib="webworker" />

import { analyzeTrack } from "@/core/pipeline";
import type { TrackAnalysis } from "@/core/type";

/**
 * Le noyau, dans un fil séparé.
 *
 * Un GPX de 400 km porte des dizaines de milliers de points ; l'analyser sur le
 * fil principal figerait la page le temps du calcul. Le noyau n'importe rien de
 * Node — seulement `fast-xml-parser` et `simplify-js` — il tourne donc ici tel
 * quel, sans adaptation.
 *
 * Le fichier ne quitte jamais le navigateur : c'est ici qu'il est lu, et il est
 * jeté aussitôt l'analyse rendue — ADR 001.
 */

export type GpxRequest = { xml: string };
export type GpxResponse =
  | { ok: true; analysis: TrackAnalysis }
  | { ok: false; error: string };

self.addEventListener("message", (event: MessageEvent<GpxRequest>) => {
  try {
    const response: GpxResponse = {
      ok: true,
      analysis: analyzeTrack(event.data.xml),
    };
    self.postMessage(response);
  } catch (error) {
    // Une trace illisible est un cas courant, pas un incident : on la rend
    // comme une réponse pour que l'écran puisse l'afficher.
    const response: GpxResponse = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
});
