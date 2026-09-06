"use client";

import { Button } from "@/ui/Button";
import { ToggleChip } from "@/ui/Chip";
import { FieldLabel, MeasureField, TextField } from "@/ui/Field";
import { ChevronIcon, TrashIcon } from "@/ui/icons";
import type { Row } from "./stations";

/**
 * Une carte de la pile des ravitos. Une seule reste ouverte : ouvrir la
 * suivante replie la précédente, et la colonne garde sa hauteur d'un bout à
 * l'autre de la saisie.
 */
export function AidStationCard({
  rang,
  ligne,
  ouverte,
  onOuvrir,
  onChange,
  onRetirer,
}: {
  rang: number;
  ligne: Row;
  ouverte: boolean;
  onOuvrir: () => void;
  onChange: (patch: Partial<Row>) => void;
  onRetirer: () => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-[var(--radius-panel)] border transition-colors ${
        ouverte
          ? "border-accent bg-paper"
          : "border-line bg-paper hover:border-line-strong"
      }`}
    >
      <button
        type="button"
        onClick={onOuvrir}
        aria-expanded={ouverte}
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
            ouverte
              ? "bg-accent text-paper"
              : "border border-accent/40 text-accent"
          }`}
        >
          {rang}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-ink">
            {ligne.name.trim() === "" ? `Ravito ${rang}` : ligne.name}
          </span>
          <span className="block font-mono text-[11px] text-ink-soft">
            {ligne.km === "" ? "sans position" : `${ligne.km} km`}
            {ligne.stopMin.trim() !== "" && (
              <>
                <span className="px-1.5 text-ink-faint">·</span>
                {ligne.stopMin} min d'arrêt
              </>
            )}
          </span>
        </span>

        <ChevronIcon
          className={`size-4 shrink-0 text-ink-faint transition-transform ${ouverte ? "rotate-180" : ""}`}
        />
      </button>

      {ouverte && (
        <div className="flex flex-col gap-4 border-line border-t px-3 pt-3.5 pb-3">
          <div className="flex gap-3">
            <MeasureField
              label="Position"
              unite="km"
              largeur="w-28"
              placeholder="9,8"
              value={ligne.km}
              onChange={(event) => onChange({ km: event.target.value })}
            />
            <MeasureField
              label="Arrêt"
              unite="min"
              largeur="w-24"
              placeholder="0"
              value={ligne.stopMin}
              onChange={(event) => onChange({ stopMin: event.target.value })}
            />
          </div>

          <TextField
            label="Nom"
            placeholder="Col de Saverne"
            value={ligne.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />

          <div className="flex flex-col gap-2">
            <FieldLabel>Ce qu'on y trouve</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                actif={ligne.eau}
                onChange={(eau) => onChange({ eau })}
              >
                de l'eau
              </ToggleChip>
              <ToggleChip
                actif={ligne.solide}
                onChange={(solide) => onChange({ solide })}
              >
                à manger
              </ToggleChip>
            </div>
            <p className="text-[11px] text-ink-faint leading-relaxed">
              Sans eau ici, le calcul ne remplira pas les flasques à cette borne
              : elles se préparent au dernier ravito qui en donnait.
            </p>
          </div>

          <Button
            ton="retrait"
            icone={<TrashIcon className="size-4" />}
            onClick={onRetirer}
            className="self-start"
          >
            retirer ce ravito
          </Button>
        </div>
      )}
    </article>
  );
}
