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
import type { OfficialRace } from "@/app/plans/officialRaces";
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
import { ArrowRightIcon, SpinnerIcon } from "@/ui/icons";
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
 * D'où vient la course : le fichier qu'on vient de lire, ou une carte du
 * catalogue. Les deux portes de l'accueil, une seule fiche.
 *
 * Un GPX arrive lu, la fiche a tout sous la main. Une course officielle garde
 * sa trace en base : la fiche s'ouvre sans elle et la reçoit quand elle
 * arrive, `points` restant nuls d'ici là. Rien n'attend cette trace, ni la
 * saisie, ni la création du plan — elle ne sert qu'à montrer où l'on court.
 */
export type RaceSource =
  | { kind: "gpx"; track: ParsedTrack }
  | {
      kind: "officielle";
      race: OfficialRace;
      points: ResolvedPoint[] | null;
      /** Ce qui a manqué, si la trace n'est pas arrivée. */
      traceError?: string | null;
    };

/**
 * La fiche qui s'ouvre entre la course et le plan : le nom, le chrono visé,
 * et le tracé avec le relief comme confirmation qu'on parle bien de la bonne
 * course. Le plan n'existe qu'à sa confirmation, ce qui vaut pour les deux
 * portes : cliquer une carte du catalogue laissait jusqu'ici un plan derrière
 * chaque coup d'œil.
 *
 * `onConfirm` crée le plan et navigue ; un message renvoyé rouvre la fiche
 * sur le reproche, `null` la laisse se refermer sur la navigation.
 */
export function ImportRaceModal({
  source,
  onCancel,
  onConfirm,
}: {
  source: RaceSource;
  onCancel: () => void;
  onConfirm: (
    raceName: string,
    targetTimeS: number | undefined,
  ) => Promise<string | null>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const gpx = source.kind === "gpx" ? source.track : null;
  // Le nom d'un fichier est rarement celui de la course, et le GPX n'en porte
  // pas toujours ; une course officielle, elle, arrive nommée.
  const releve =
    source.kind === "gpx"
      ? {
          name:
            source.track.name?.trim() ||
            raceNameFromFileName(source.track.fileName),
          distanceM: source.track.distanceM,
          ascentM: source.track.ascentM,
        }
      : source.race;

  const [name, setName] = useState(releve.name);
  const base = useMemo(
    () => baseChronoHMS(releve.distanceM),
    [releve.distanceM],
  );
  const [chrono, setChrono] = useState<HMS>(base);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const pace = paceLabel(toSecondsHMS(chrono), releve.distanceM);

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
            <Onglet>{gpx ? "gpx" : "plan"}</Onglet>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">
              {gpx ? gpx.fileName : releve.name}
            </p>
            <p className="text-ink-soft text-xs">
              {source.kind === "gpx" ? (
                <>
                  {entier(source.track.points.length)} points lus, trace valide
                </>
              ) : (
                <>
                  course officielle, {entier(source.race.aidStationCount)}{" "}
                  ravito{source.race.aidStationCount > 1 ? "s" : ""} déjà posé
                  {source.race.aidStationCount > 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>
          {gpx && (
            <Button
              ton="retrait"
              onClick={onCancel}
              className="shrink-0 text-xs"
            >
              remplacer
            </Button>
          )}
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
              <Hint>
                {gpx
                  ? "repris du fichier, modifiable"
                  : "celui de la course, modifiable"}
              </Hint>
            </div>

            <div className="flex gap-6">
              <Stat value={km(releve.distanceM)} unite="km" label="distance" />
              <Stat
                value={entier(releve.ascentM)}
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
              {gpx
                ? "Le fichier n'est pas conservé : seuls la trace et le profil sont enregistrés avec le plan."
                : "Le plan qui s'ouvre est une copie. Elle porte la trace et les ravitos, le poids et les produits restent à saisir."}
            </Hint>
          </div>

          <div className="flex min-h-[240px] flex-1 flex-col sm:min-h-0">
            <Apercu
              points={
                source.kind === "gpx" ? source.track.points : source.points
              }
              traceError={source.kind === "gpx" ? null : source.traceError}
              hoverIndex={hoverIndex}
              onHoverIndex={setHoverIndex}
            />
          </div>
        </div>

        {error && (
          <div className="border-line border-t px-5 py-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <ModalFoot>
          <Button ton="retrait" onClick={onCancel}>
            {gpx ? "annuler l'import" : "annuler"}
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

/**
 * Le tracé et le relief, ou ce qui en tient lieu tant qu'ils manquent.
 *
 * La trace d'une course officielle se lit en base au clic sur la carte : de
 * deux cents kilo-octets à un mégaoctet et demi, que la fiche n'attend pas
 * pour s'ouvrir. La roue occupe le cadre en attendant, et le formulaire est
 * déjà saisissable à côté. Une trace qui n'arrive pas n'empêche pas d'ouvrir
 * le plan : c'est le modèle qui la porte, pas cet écran.
 */
function Apercu({
  points,
  traceError,
  hoverIndex,
  onHoverIndex,
}: {
  points: ResolvedPoint[] | null;
  traceError?: string | null;
  hoverIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}) {
  if (!points) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-paper-dim text-ink-soft">
        {traceError ? (
          <p className="max-w-[240px] px-5 text-center text-[13px]">
            {traceError}
          </p>
        ) : (
          <>
            <SpinnerIcon className="size-6" />
            <p className="text-[11px]">Lecture de la trace</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="relative flex-[1.3] overflow-hidden bg-paper-dim">
        <RouteMap
          points={points}
          hoverIndex={hoverIndex}
          onHoverIndex={onHoverIndex}
        />
        <span className="pointer-events-none absolute top-2 left-3 z-[1000]">
          <Onglet>tracé</Onglet>
        </span>
      </div>

      <div className="min-h-[130px] flex-1 border-line border-t">
        <ElevationChart
          points={points}
          hoverIndex={hoverIndex}
          onHoverIndex={onHoverIndex}
        />
      </div>
    </>
  );
}
