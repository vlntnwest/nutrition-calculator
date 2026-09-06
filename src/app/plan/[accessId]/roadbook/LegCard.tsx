"use client";

import { useState } from "react";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { type HMS, toHMS, toSecondsHMS } from "@/format/clock";
import { duree, ecart, entier, quantite, toNumber } from "@/format/number";
import { formatFr } from "@/format/produit";
import { Button, IconButton } from "@/ui/Button";
import { Tag } from "@/ui/Chip";
import { ChronoInput } from "@/ui/Chrono";
import { MeasureField } from "@/ui/Field";
import { CloseIcon, FlaskIcon, PlusIcon } from "@/ui/icons";
import { Releve, Val } from "@/ui/Measure";
import { Notice } from "@/ui/Notice";
import { Rule } from "@/ui/Panel";
import { Stepper } from "@/ui/Stepper";
import { bound, excessive } from "./format";
import { warningText } from "./warnings";

type Edit = RoadbookEdit["servings"][number];

/**
 * Un secteur du roadbook. Il se lit de haut en bas comme une consigne de
 * course : où il s'arrête, combien de temps il dure, ce qu'on y prend, ce que
 * cela donne, et ce qui cloche.
 */
export function LegCard({
  leg,
  rations,
  remplissages,
  roadbook,
  cibleGH,
  totalM,
  vieux,
  onServing,
  onFill,
  onImposerDuree,
  onImposerCible,
  imposing,
}: {
  leg: Roadbook["legs"][number];
  rations: Edit;
  remplissages: RoadbookEdit["fills"][number];
  roadbook: Roadbook;
  /** La cible horaire qui s'applique ici, imposée ou héritée du plan. */
  cibleGH: number;
  totalM: number;
  /** Les agrégats datent du dernier enregistrement. */
  vieux: string;
  onServing: (snapshotId: string, quantity: number) => void;
  onFill: (
    flaskRank: number,
    contenu: { productSnapshotId: string | null; volumeMl: number } | null,
  ) => void;
  onImposerDuree: (durationS: number | null) => void;
  onImposerCible: (carbsGH: number | null) => void;
  imposing: boolean;
}) {
  const [dureeOuverte, setDureeOuverte] = useState(false);
  const [cibleOuverte, setCibleOuverte] = useState(false);
  const [saisieDuree, setSaisieDuree] = useState<HMS>(() =>
    toHMS(leg.imposedDurationS ?? leg.durationS),
  );
  const [saisieCible, setSaisieCible] = useState(String(Math.round(cibleGH)));

  const produitDe = (id: string) => roadbook.catalogue.find((p) => p.id === id);
  const nomDe = (id: string) => {
    const p = produitDe(id);

    return p ? `${p.brandName ?? ""} ${p.name}`.trim() : id;
  };
  const absents = roadbook.catalogue.filter(
    (p) => !rations.some((r) => r.productSnapshotId === p.id),
  );
  const ration = (id: string) =>
    leg.servings.find((s) => s.productSnapshotId === id);
  const trop = excessive(leg.supply.carbsG, leg.needG);

  return (
    <article
      id={`secteur-${leg.rank}`}
      className="scroll-mt-4 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3.5 pb-3">
        <h3 className="font-semibold text-[15px] text-ink">
          Secteur {leg.rank}
        </h3>
        <p className="min-w-0 flex-1 text-[12px] text-ink-soft">
          jusqu'à {bound(leg, totalM)}
          {leg.endName && (
            <>
              <span className="px-1.5 text-ink-faint">·</span>
              {leg.endName}
            </>
          )}
        </p>
        <p className="font-mono text-[13px] text-ink">
          {duree(leg.durationS)}
          <span className="px-1.5 text-ink-faint">·</span>
          <span className="text-ink-soft">
            +{entier(leg.ascentM)} m / −{entier(leg.descentM)} m
          </span>
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {leg.imposedDurationS === null ? (
          <Button
            taille="sm"
            ton="discret"
            disabled={imposing}
            onClick={() => setDureeOuverte(!dureeOuverte)}
            aria-expanded={dureeOuverte}
          >
            imposer une durée
          </Button>
        ) : (
          <Tag ton="accent">
            durée imposée {duree(leg.imposedDurationS)}
            <button
              type="button"
              onClick={() => onImposerDuree(null)}
              disabled={imposing}
              aria-label="Retirer la durée imposée"
              className="cursor-pointer disabled:opacity-40"
            >
              <CloseIcon className="size-3" />
            </button>
          </Tag>
        )}

        {leg.imposedCarbsGH === null ? (
          <Button
            taille="sm"
            ton="discret"
            disabled={imposing}
            onClick={() => setCibleOuverte(!cibleOuverte)}
            aria-expanded={cibleOuverte}
          >
            cible {entier(cibleGH)} g/h
          </Button>
        ) : (
          <Tag ton="accent">
            cible imposée {entier(leg.imposedCarbsGH)} g/h
            <button
              type="button"
              onClick={() => onImposerCible(null)}
              disabled={imposing}
              aria-label="Retirer la cible imposée"
              className="cursor-pointer disabled:opacity-40"
            >
              <CloseIcon className="size-3" />
            </button>
          </Tag>
        )}
      </div>

      {dureeOuverte && leg.imposedDurationS === null && (
        <Consigne
          aide="Le temps de mouvement imposé à ce secteur. Les autres se serrent d'autant."
          onValider={() => {
            const secondes = toSecondsHMS(saisieDuree);
            if (secondes !== undefined && secondes > 0) {
              onImposerDuree(secondes);
              setDureeOuverte(false);
            }
          }}
          imposing={imposing}
        >
          <ChronoInput
            value={saisieDuree}
            onChange={setSaisieDuree}
            taille="sm"
          />
        </Consigne>
      )}

      {cibleOuverte && leg.imposedCarbsGH === null && (
        <Consigne
          aide="La cible de glucides de ce seul secteur, quand la cible du plan n'y convient pas."
          onValider={() => {
            const valeur = toNumber(saisieCible);
            if (valeur !== undefined && valeur >= 0) {
              onImposerCible(valeur);
              setCibleOuverte(false);
            }
          }}
          imposing={imposing}
        >
          <MeasureField
            label="Glucides sur ce secteur"
            unite="g/h"
            largeur="w-32"
            value={saisieCible}
            onChange={(event) => setSaisieCible(event.target.value)}
          />
        </Consigne>
      )}

      <Rule />

      <ul className="flex flex-col">
        {rations.length === 0 && (
          <li className="px-4 py-3 text-[13px] text-ink-faint">
            Rien de posé sur ce secteur.
          </li>
        )}

        {rations.map((r) => {
          const produit = produitDe(r.productSnapshotId);
          const detail = ration(r.productSnapshotId);
          const pas = 1 / (produit?.divisibleBy ?? 1);

          return (
            <li
              key={r.productSnapshotId}
              className="flex items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0"
            >
              <Stepper
                value={r.quantity}
                pas={pas}
                libelle={nomDe(r.productSnapshotId)}
                onChange={(quantity) =>
                  onServing(r.productSnapshotId, quantity)
                }
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink">
                  {produit?.name ?? r.productSnapshotId}
                </p>
                <p className="font-mono text-[11px] text-ink-soft">
                  {produit?.brandName}
                  {detail && (
                    <>
                      <span className="px-1.5 text-ink-faint">·</span>
                      {formatFr(detail.formatLabel)}
                      <span className="px-1.5 text-ink-faint">·</span>
                      {quantite(
                        Math.round(detail.carbsG * r.quantity * 10) / 10,
                      )}{" "}
                      g glucides
                    </>
                  )}
                </p>
              </div>

              <IconButton
                libelle={`Retirer ${nomDe(r.productSnapshotId)} du secteur ${leg.rank}`}
                onClick={() => onServing(r.productSnapshotId, 0)}
              >
                <CloseIcon className="size-4" />
              </IconButton>
            </li>
          );
        })}
      </ul>

      {absents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-line border-t px-4 py-2.5">
          <label className="flex items-center gap-2 text-[12px] text-ink-soft">
            <PlusIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">
              Ajouter un produit à ce secteur
            </span>
            <select
              value=""
              aria-label={`Ajouter un produit au secteur ${leg.rank}`}
              onChange={(event) => {
                if (event.target.value) onServing(event.target.value, 1);
              }}
              className="cursor-pointer rounded-[var(--radius-control)] border border-line bg-paper px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
            >
              <option value="">choisir dans le sac</option>
              {absents.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.brandName ?? ""} ${p.name}`.trim()}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className={`border-line border-t bg-paper-dim px-4 py-3 ${vieux}`}>
        <p className="text-[14px] text-ink">
          Apport <Val>{entier(leg.supply.carbsG)} g</Val> de glucides{" "}
          {ecart(leg.marginG) !== "" && (
            <span
              className={trop ? "font-medium text-accent" : "text-ink-soft"}
            >
              ({ecart(leg.marginG)}
              {trop ? ", au-dessus du besoin" : ""})
            </span>
          )}
        </p>
        <Releve
          className="mt-0.5"
          items={[
            `${entier(leg.supply.energyKcal)} kcal`,
            `${entier(leg.supply.sodiumMg)} mg de sodium`,
            `${entier(leg.supply.fluidMl)} mL apportés`,
            <>
              à boire <Val>{entier(leg.needFluidMl)} mL</Val>
            </>,
          ]}
        />
      </div>

      <div className={`border-line border-t px-4 py-3 ${vieux}`}>
        {leg.opensLiquidSpan ? (
          <ul className="flex flex-col gap-2">
            {roadbook.flasks.map((flask) => {
              const verse = remplissages.find(
                (f) => f.flaskRank === flask.rank,
              );

              return (
                <li key={flask.rank} className="flex items-center gap-2.5">
                  <FlaskIcon className="size-4 shrink-0 text-ink-faint" />
                  <span className="shrink-0 text-[13px] text-ink-soft">
                    Flasque {flask.rank}
                  </span>
                  <select
                    aria-label={`Contenu de la flasque ${flask.rank} au secteur ${leg.rank}`}
                    value={
                      verse === undefined
                        ? "vide"
                        : (verse.productSnapshotId ?? "eau")
                    }
                    onChange={(event) => {
                      const v = event.target.value;
                      if (v === "vide") return onFill(flask.rank, null);

                      onFill(flask.rank, {
                        productSnapshotId: v === "eau" ? null : v,
                        volumeMl: verse?.volumeMl ?? flask.volumeMl,
                      });
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded-[var(--radius-control)] border border-line bg-paper px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
                  >
                    <option value="vide">rien</option>
                    <option value="eau">eau claire</option>
                    {!flask.onlyWater &&
                      roadbook.catalogue.map((p) => (
                        <option key={p.id} value={p.id}>
                          {`${p.brandName ?? ""} ${p.name}`.trim()}
                        </option>
                      ))}
                  </select>
                  {verse !== undefined && (
                    <input
                      type="number"
                      min={1}
                      step={10}
                      value={verse.volumeMl}
                      aria-label={`Volume de la flasque ${flask.rank} au secteur ${leg.rank}`}
                      onChange={(event) =>
                        onFill(flask.rank, {
                          productSnapshotId: verse.productSnapshotId,
                          volumeMl: Number(event.target.value),
                        })
                      }
                      className="w-20 shrink-0 rounded-[var(--radius-control)] border border-line bg-paper px-2 py-1.5 font-mono text-[13px] outline-none focus:border-accent"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-faint leading-relaxed">
            Pas de remplissage ici : les flasques sont préparées en amont, au
            dernier ravito qui donnait de l'eau.
          </p>
        )}
      </div>

      {leg.warnings.length > 0 && (
        <div className={`flex flex-col gap-2 px-4 pb-3 ${vieux}`}>
          {leg.warnings.map((w) => (
            <Notice key={w.code} code={w.code}>
              {warningText(w.code, w.payload)}
            </Notice>
          ))}
        </div>
      )}
    </article>
  );
}

/** Le tiroir d'une consigne : la saisie, puis le geste qui la pose. */
function Consigne({
  aide,
  children,
  onValider,
  imposing,
}: {
  aide: string;
  children: React.ReactNode;
  onValider: () => void;
  imposing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-line border-t bg-paper-dim px-4 py-3">
      <div className="w-40">{children}</div>
      <Button ton="encre" taille="sm" disabled={imposing} onClick={onValider}>
        {imposing ? "Recalcul" : "Imposer et recalculer"}
      </Button>
      <p className="w-full text-[11px] text-ink-faint leading-relaxed">
        {aide}
      </p>
    </div>
  );
}
