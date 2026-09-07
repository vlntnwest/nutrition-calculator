"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SpinnerIcon, UploadIcon } from "@/ui/icons";

export type ImportStatus =
  | { kind: "vide" }
  | { kind: "lecture" }
  | { kind: "erreur"; message: string };

/**
 * Le panneau de dépôt : le champ de fichier et le glisser-déposer, tous deux
 * vers `onFile`. Le glisser-déposer est actif sur tout l'écran — un fichier
 * survolant la page où que ce soit fait apparaître le cadre plein écran, pas
 * seulement le panneau au centre.
 *
 * Le déclencheur est une étiquette liée au champ, jamais un bouton qui
 * appellerait `input.click()` : les navigateurs mobiles refusent d'ouvrir le
 * sélecteur pour un champ qu'ils tiennent pour invisible, et le tap ne
 * donnait rien. Une étiquette, elle, active le champ nativement.
 */
export function ImportDropzone({
  status,
  onFile,
}: {
  status: ImportStatus;
  onFile: (file: File) => void;
}) {
  const [draggingOverPage, setDraggingOverPage] = useState(false);
  const dragDepth = useRef(0);
  const champ = useId();
  const lecture = status.kind === "lecture";

  useEffect(() => {
    function isFileDrag(e: DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }

    function onWindowDragEnter(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDraggingOverPage(true);
    }

    function onWindowDragOver(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    }

    function onWindowDragLeave(e: DragEvent) {
      if (!isFileDrag(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDraggingOverPage(false);
    }

    function onWindowDrop(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDraggingOverPage(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onFile(file);
    }

    window.addEventListener("dragenter", onWindowDragEnter);
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("drop", onWindowDrop);

    return () => {
      window.removeEventListener("dragenter", onWindowDragEnter);
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [onFile]);

  return (
    <>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full rounded-[28px] border border-white/40 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 sm:px-24 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-ink/30 bg-white/15 text-ink">
              {lecture ? (
                <SpinnerIcon className="size-6" />
              ) : (
                <UploadIcon className="size-6" />
              )}
            </span>

            <div className="space-y-1">
              <p className="font-medium text-ink text-lg">
                {lecture ? "Lecture de la trace" : "Déposez le fichier ici"}
              </p>
              <p className="text-ink/70 text-sm">.gpx</p>
            </div>

            {/* Le champ précède son étiquette : `peer` ne parle qu'aux
                frères qui le suivent, et c'est lui qui porte l'état. */}
            <input
              id={champ}
              type="file"
              accept=".gpx,application/gpx+xml"
              disabled={lecture}
              className="peer sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];

                // Le champ se vide aussitôt : reprendre le même fichier après
                // une erreur ou une annulation doit relancer la lecture, et
                // `change` ne repart pas sur une valeur inchangée.
                e.target.value = "";

                if (file) onFile(file);
              }}
            />

            <label
              htmlFor={champ}
              className="cursor-pointer rounded-full bg-paper px-6 py-2.5 font-medium text-ink text-sm transition hover:bg-paper-dim peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink peer-disabled:pointer-events-none peer-disabled:opacity-50"
            >
              Choisir un fichier
            </label>
          </div>
        </div>
      </div>

      {status.kind === "erreur" && (
        <p
          role="alert"
          className="mx-auto mb-6 w-full max-w-md rounded-2xl border border-line bg-paper px-5 py-3 text-center text-sm"
        >
          Import impossible. {status.message}
        </p>
      )}

      {draggingOverPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-md">
          <div className="pointer-events-none fixed inset-3 rounded-[28px] border-2 border-white" />

          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-white/50 bg-white/15 text-white">
              <UploadIcon className="size-6" />
            </span>
            <p className="text-xl font-medium text-paper">
              Déposez le fichier ici
            </p>
            <p className="text-sm text-paper/70">.gpx</p>
          </div>
        </div>
      )}
    </>
  );
}
