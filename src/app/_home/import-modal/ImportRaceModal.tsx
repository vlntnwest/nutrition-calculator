"use client";

import dynamic from "next/dynamic";
import {
  type FormEvent,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ElevationChart } from "@/components/track/ElevationChart";
import type { ProfilePoint, ResolvedPoint } from "@/core/type";
import {
  digitsOnly,
  paceLabel,
  raceNameFromFileName,
  toSecondsHMS,
} from "./fields";

// Leaflet lit `window` dès son import : un module client-only, jamais
// rendu côté serveur pour l'hydratation.
const RouteMap = dynamic(() => import("@/components/track/RouteMap"), {
  ssr: false,
});

/** Ce que la lecture du GPX rend, avant que le plan n'existe. */
export type ParsedTrack = {
  fileName: string;
  name: string | null;
  distanceM: number;
  ascentM: number;
  points: ResolvedPoint[];
  profile: ProfilePoint[];
};

/**
 * La fiche qui s'ouvre entre l'import et le plan : nom de la course et
 * chrono visé, avec le tracé et le relief comme confirmation qu'on parle
 * bien du bon fichier. `onConfirm` crée le plan et navigue ; un message
 * renvoyé rouvre la fiche sur le reproche, `null` la laisse se refermer sur
 * la navigation.
 */
export function ImportRaceModal({
  track,
  onCancel,
  onConfirm,
}: {
  track: ParsedTrack;
  onCancel: () => void;
  onConfirm: (
    raceName: string,
    targetTimeS: number | undefined,
  ) => Promise<string | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const [name, setName] = useState(
    () => track.name?.trim() || raceNameFromFileName(track.fileName),
  );
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // La boîte ne doit s'ouvrir qu'une fois : un ref tient le dernier
  // `onCancel` pour que l'effet n'ait pas à le lister en dépendance et à
  // rejouer `showModal` à chaque rendu du parent.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Ouvre la boîte native au montage — elle porte elle-même le focus, le
  // piège au clavier et la fermeture sur Échap ; `onCancel` n'a plus qu'à
  // écouter sa fermeture, quelle qu'en soit la cause.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    nameRef.current?.select();

    function onClose() {
      onCancelRef.current();
    }

    dialog.addEventListener("close", onClose);

    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const pace = paceLabel(toSecondsHMS(h, m, s), track.distanceM);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    const result = await onConfirm(name.trim(), toSecondsHMS(h, m, s));

    if (result) {
      setError(result);
      setPending(false);
    }
    // Sinon la navigation est déjà partie : rien à remettre à jour ici.
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: ferme sur le clic hors contenu ; le clavier ferme déjà la boîte nativement, via Échap.
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(event) => {
        // Un clic sur le fond (`::backdrop`) cible la boîte elle-même,
        // jamais son contenu : c'est ce qui distingue « en dehors ».
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-[20px] border border-line bg-paper p-0 text-ink shadow-2xl shadow-black/30 backdrop:bg-ink/70 backdrop:backdrop-blur-md"
    >
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex items-center gap-3 border-line border-b px-5 py-3.5">
          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md border border-line font-mono text-[10px] text-ink-soft uppercase">
            gpx
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{track.fileName}</p>
            <p className="text-ink-soft text-xs">
              {track.points.length.toLocaleString("fr-FR")} points lus · trace
              valide
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="shrink-0 text-ink-soft text-xs underline underline-offset-2 hover:text-ink"
          >
            remplacer
          </button>
        </div>

        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-5 p-5 sm:w-[300px] sm:shrink-0 sm:border-line sm:border-r">
            <div className="flex flex-col gap-1">
              <label className="text-ink-soft text-xs" htmlFor={titleId}>
                Nom de la course
              </label>
              <input
                ref={nameRef}
                id={titleId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom de la course"
                className="rounded-md border border-accent bg-transparent px-3 py-2.5 text-base outline-none"
              />
              <p className="text-[11px] text-ink-soft">
                repris du fichier, modifiable
              </p>
            </div>

            <div className="flex gap-6">
              <Stat
                value={(track.distanceM / 1000).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })}
                unit="km"
                label="distance"
              />
              <Stat
                value={Math.round(track.ascentM).toLocaleString("fr-FR")}
                unit="m"
                label="dénivelé +"
              />
            </div>

            <div className="h-px bg-line" />

            <div className="flex flex-col gap-2">
              <span className="text-ink-soft text-xs">Chrono visé</span>
              <div className="flex items-end gap-1.5">
                <ChronoField
                  label="h"
                  value={h}
                  onChange={(value) => {
                    const digits = digitsOnly(value);
                    setH(digits);
                    if (digits.length === 2) minuteRef.current?.focus();
                  }}
                />
                <ChronoField
                  ref={minuteRef}
                  label="min"
                  value={m}
                  onChange={(value) => {
                    const digits = digitsOnly(value);
                    setM(digits);
                    if (digits.length === 2) secondRef.current?.focus();
                  }}
                />
                <ChronoField
                  ref={secondRef}
                  label="s"
                  value={s}
                  onChange={(value) => setS(digitsOnly(value))}
                />
              </div>
              {pace && (
                <p className="text-ink-soft text-xs">
                  soit <span className="font-mono text-ink">{pace} /km</span> de
                  moyenne — ajustable ensuite
                </p>
              )}
            </div>

            <p className="text-[11px] text-ink-soft leading-relaxed">
              Le fichier n'est pas conservé : seuls la trace et le profil sont
              enregistrés avec le plan.
            </p>
          </div>

          <div className="flex min-h-[220px] flex-1 flex-col sm:min-h-0">
            <div className="relative flex-[1.3] overflow-hidden bg-paper-dim">
              <RouteMap
                points={track.points}
                hoverIndex={hoverIndex}
                onHoverIndex={setHoverIndex}
              />
              <span className="pointer-events-none absolute top-2 left-3 z-[1000] text-[10px] text-ink-soft uppercase">
                tracé
              </span>
            </div>

            <div className="min-h-0 flex-1 border-line border-t">
              <ElevationChart
                points={track.points}
                hoverIndex={hoverIndex}
                onHoverIndex={setHoverIndex}
              />
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="border-line border-t bg-paper-dim px-5 py-3 text-sm"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 border-line border-t bg-paper-dim px-5 py-3.5">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-ink-soft text-sm hover:text-ink"
          >
            annuler l'import
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-6 py-2.5 font-medium text-paper text-sm transition hover:bg-ink/85 disabled:opacity-50"
          >
            {pending ? "Création…" : "Continuer ▸"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Stat({
  value,
  unit,
  label,
}: {
  value: string;
  unit: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-xl">{value}</span>
        <span className="text-ink-soft text-xs">{unit}</span>
      </div>
      <p className="text-[11px] text-ink-soft">{label}</p>
    </div>
  );
}

function ChronoField({
  label,
  value,
  onChange,
  ref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="flex flex-1 flex-col items-center gap-1">
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        placeholder="00"
        aria-label={label}
        className="w-full rounded-md border border-line bg-paper px-1 py-2 text-center font-mono text-lg tabular-nums outline-none focus:border-accent"
      />
      <span className="text-[10px] text-ink-soft uppercase">{label}</span>
    </label>
  );
}
