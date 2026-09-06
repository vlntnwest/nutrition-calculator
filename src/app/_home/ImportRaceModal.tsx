"use client";

import dynamic from "next/dynamic";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ProfilePoint, ResolvedPoint } from "@/core/type";
import {
  baseChronoHMS,
  type HMS,
  paceLabel,
  raceNameFromFileName,
  toSecondsHMS,
} from "@/format/clock";
import { entier, km } from "@/format/number";
import { Button } from "@/ui/Button";
import { ChronoInput } from "@/ui/Chrono";
import { FieldLabel, Hint } from "@/ui/Field";
import { ArrowRightIcon } from "@/ui/icons";
import { Stat, Val } from "@/ui/Measure";
import { Modal, ModalFoot } from "@/ui/Modal";
import { ErrorNote } from "@/ui/Notice";
import { Onglet } from "@/ui/Panel";
import { ElevationChart } from "@/ui/track/ElevationChart";

// Leaflet lit `window` dès son import : un module client-only, jamais
// rendu côté serveur pour l'hydratation.
const RouteMap = dynamic(() => import("@/ui/track/RouteMap"), { ssr: false });

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
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const [name, setName] = useState(
    () => track.name?.trim() || raceNameFromFileName(track.fileName),
  );
  const base = useMemo(() => baseChronoHMS(track.distanceM), [track.distanceM]);
  const [chrono, setChrono] = useState<HMS>(base);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const pace = paceLabel(toSecondsHMS(chrono), track.distanceM);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    const result = await onConfirm(name.trim(), toSecondsHMS(chrono));

    if (result) {
      setError(result);
      setPending(false);
    }
    // Sinon la navigation est déjà partie : rien à remettre à jour ici.
  }

  return (
    <Modal labelledBy={titleId} onClose={onCancel} largeur="sm:max-w-3xl">
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex items-center gap-3 border-line border-b px-5 py-3.5">
          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line">
            <Onglet>gpx</Onglet>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{track.fileName}</p>
            <p className="text-ink-soft text-xs">
              {entier(track.points.length)} points lus, trace valide
            </p>
          </div>
          <Button ton="retrait" onClick={onCancel} className="shrink-0 text-xs">
            remplacer
          </Button>
        </div>

        <div className="flex flex-col-reverse sm:flex-row">
          <div className="flex flex-col gap-5 p-5 sm:w-[300px] sm:shrink-0 sm:border-line sm:border-r">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={titleId}>Nom de la course</FieldLabel>
              <input
                ref={nameRef}
                id={titleId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom de la course"
                className="rounded-[var(--radius-control)] border border-accent bg-transparent px-3 py-2.5 text-base outline-none"
              />
              <Hint>repris du fichier, modifiable</Hint>
            </div>

            <div className="flex gap-6">
              <Stat value={km(track.distanceM)} unite="km" label="distance" />
              <Stat
                value={entier(track.ascentM)}
                unite="m"
                label="dénivelé positif"
              />
            </div>

            <div className="h-px bg-line" />

            <div className="flex flex-col gap-2">
              <FieldLabel>Chrono visé</FieldLabel>
              <ChronoInput value={chrono} onChange={setChrono} />
              <p className="text-ink-soft text-xs">
                {pace ? (
                  <>
                    soit <Val>{pace} /km</Val> de moyenne, ajustable ensuite
                  </>
                ) : (
                  "un chrono est nécessaire pour calculer le plan"
                )}
              </p>
            </div>

            <Hint>
              Le fichier n'est pas conservé : seuls la trace et le profil sont
              enregistrés avec le plan.
            </Hint>
          </div>

          <div className="flex min-h-[240px] flex-1 flex-col sm:min-h-0">
            <div className="relative flex-[1.3] overflow-hidden bg-paper-dim">
              <RouteMap
                points={track.points}
                hoverIndex={hoverIndex}
                onHoverIndex={setHoverIndex}
              />
              <span className="pointer-events-none absolute top-2 left-3 z-[1000]">
                <Onglet>tracé</Onglet>
              </span>
            </div>

            <div className="min-h-[130px] flex-1 border-line border-t">
              <ElevationChart
                points={track.points}
                hoverIndex={hoverIndex}
                onHoverIndex={setHoverIndex}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="border-line border-t px-5 py-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <ModalFoot>
          <Button ton="retrait" onClick={onCancel}>
            annuler l'import
          </Button>
          <Button
            type="submit"
            ton="encre"
            disabled={pending}
            iconeFin={!pending && <ArrowRightIcon className="size-4" />}
          >
            {pending ? "Création" : "Continuer"}
          </Button>
        </ModalFoot>
      </form>
    </Modal>
  );
}
