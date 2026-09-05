"use client";

import { useEffect, useRef, useState } from "react";
import { UploadGlyph } from "../icons/UploadGlyph";

export type ImportStatus =
  | { kind: "vide" }
  | { kind: "lecture" }
  | { kind: "erreur"; message: string };

/**
 * Le panneau de dépôt : bouton et glisser-déposer, tous deux vers `onFile`.
 * Le glisser-déposer est actif sur tout l'écran — un fichier survolant la
 * page où que ce soit fait apparaître le cadre plein écran, pas seulement
 * le panneau au centre.
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
  const inputRef = useRef<HTMLInputElement>(null);
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
          <div className="flex h-full flex-col items-center justify-center gap-3 px-24 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-black/30 bg-white/15 text-black">
              <UploadGlyph />
            </span>

            <div className="space-y-1">
              <p className="font-medium text-lg text-black">
                {lecture ? "Lecture en cours…" : "Déposez le fichier ici"}
              </p>
              <p className="text-sm text-black/70">.gpx</p>
            </div>

            <button
              type="button"
              disabled={lecture}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-paper px-6 py-2.5 font-medium text-ink text-sm transition hover:bg-paper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-50 cursor-pointer"
            >
              Choisir un fichier
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
              }}
            />
          </div>
        </div>
      </div>

      {status.kind === "erreur" && (
        <p
          role="alert"
          className="mx-auto mb-6 w-full max-w-md rounded-2xl border border-line bg-paper-dim px-5 py-3 text-center text-sm"
        >
          Import impossible — {status.message}
        </p>
      )}

      {draggingOverPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-md">
          <div className="pointer-events-none fixed inset-3 rounded-[28px] border-2 border-white" />

          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-white/50 bg-white/15 text-white">
              <UploadGlyph />
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
