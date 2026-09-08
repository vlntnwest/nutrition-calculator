"use client";

import { useState } from "react";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { clockLabel, type HMS, toHMS, toSecondsHMS } from "@/format/clock";
import { duree, ecart, entier, km, quantite, toNumber } from "@/format/number";
import { formatFr, nomProduit } from "@/format/produit";
import { Button, IconButton } from "@/ui/Button";
import { Tag } from "@/ui/Chip";
import { ChronoInput } from "@/ui/Chrono";
import { MeasureField } from "@/ui/Field";
import { ChevronIcon, CloseIcon, FlaskIcon, PlusIcon } from "@/ui/icons";
import { Releve, Val } from "@/ui/Measure";
import { Notice } from "@/ui/Notice";
import { Rule } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { Stepper } from "@/ui/Stepper";
import { flaskCapacityUnits, servingStep } from "./edit";
import {
  estVersable,
  excessive,
  legBounds,
  liveCarriedMl,
  liveSupply,
  startOf,
} from "./format";
import { warningText } from "./warnings";

type Edit = RoadbookEdit["servings"][number];

/**
 * Un secteur du roadbook. Il se lit de haut en bas comme une consigne de
 * course : où il s'arrête, combien de temps il dure, ce qu'on y prend, ce que
 * cela donne, et ce qui cloche.
 */
export function LegCard({
  leg,
  index,
  rations,
  remplissages,
  roadbook,
  cibleGH,
  portee,
  priseSolide,
  totalM,
  vieux,
  onServing,
  onFill,
  onImposerDuree,
  onImposerCible,
  imposing,
}: {
  leg: Roadbook["legs"][number];
  /** Son rang dans `roadbook.legs`, pour en lire les bornes et l'amont. */
  index: number;
  rations: Edit;
  remplissages: RoadbookEdit["fills"][number];
  roadbook: Roadbook;
  /** La cible horaire qui s'applique ici, imposée ou héritée du plan. */
  cibleGH: number;
  /** La portée où tombe ce secteur : là où ses flasques se préparent. */
  portee: {
    /** Le rang du secteur qui l'ouvre — lui-même, ou un secteur en amont. */
    rank: number;
    /** Le ravito où l'on charge en l'ouvrant. Nul au départ de la course. */
    ravito: string | null;
    /**
     * Ce qu'il y a à boire sur toute la portée — voir `spanFluidNeedMl`. Égal
     * à `leg.needFluidMl` dès que le ravito suivant donne de l'eau.
     */
    besoinMl: number;
    /** Les remplissages du secteur qui l'ouvre, seul à en porter. */
    remplissages: RoadbookEdit["fills"][number];
  };
  /**
   * Où se prend la nourriture d'ici : le dernier ravito qui en donnait, et le
   * secteur qu'il ouvre. Ce secteur est celui-ci quand il en ouvre une portée.
   */
  priseSolide: { rank: number; ravito: string | null };
  totalM: number;
  /** Les avertissements datent du dernier enregistrement. */
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

    return p ? `${p.brandName ?? ""} ${nomProduit(p.name)}`.trim() : id;
  };
  // Une boisson ne se pose que là où une flasque la verse : sur un secteur au
  // milieu d'une portée, le menu ne la propose pas — elle se choisirait ici
  // pour apparaître sur la carte d'à côté.
  const absents = roadbook.catalogue.filter(
    (p) =>
      !rations.some((r) => r.productSnapshotId === p.id) &&
      (leg.opensLiquidSpan || p.fluidMl === 0),
  );
  // Ce qui se verse dans une flasque se dilue : une poudre, une pastille,
  // un liquide à couper. Une barre ne se verse pas, et le noyau qui reçoit
  // un solide en remplissage compte ses glucides comme bus. La liste ne
  // propose donc que ce qui se boit.
  const versables = roadbook.catalogue.filter((p) =>
    estVersable(p.formatLabel),
  );
  const solide = (id: string) => produitDe(id)?.fluidMl === 0;
  // Un secteur se nomme par ses bornes, pas par un numéro — voir `legBounds`.
  const bornes = legBounds(roadbook.legs, index);
  const nom = `${bornes.depart} → ${bornes.arrivee}`;
  // Nommer le ravito plutôt que le secteur qu'il ouvre : les deux numérotations
  // se croisent — un secteur finit au ravito de son rang et commence à celui
  // d'avant — et « au secteur 5 » se lit « au Ravito 5 » alors que c'est le 4.
  const lieu = (o: { rank: number; ravito: string | null }) =>
    o.ravito === null ? "au départ" : `à ${o.ravito}`;
  // Recalculé sur les retouches en cours : `leg.supply` date du dernier
  // enregistrement, et doubler une gaufre doit se voir tout de suite plutôt
  // que d'attendre la sauvegarde pour savoir où l'on en est.
  const supply = liveSupply(rations, roadbook.catalogue);
  const trop = excessive(supply.carbsG, leg.needG);
  // Le liquide emporté à l'ouverture de la portée : le volume des flasques,
  // eau claire ou boisson confondues. Voir `liveCarriedMl`.
  const porte = liveCarriedMl(remplissages);
  // Quand un ravito ne donne pas d'eau, la portée déborde du secteur et
  // l'écart ne se lit plus contre le besoin de cette carte-ci : il le dit.
  // L'égalité est exacte, `spanFluidNeedMl` rendant la valeur elle-même
  // quand la portée tient en un secteur.
  const surLaPortee = portee.besoinMl !== leg.needFluidMl;

  return (
    <article
      id={`secteur-${leg.rank}`}
      className="scroll-mt-4 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper"
    >
      <header className="px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-semibold text-[15px] text-ink">
            {bornes.depart}
            <span className="px-1.5 font-normal text-ink-faint">→</span>
            {bornes.arrivee}
          </h3>
          {/* Un chrono nu en haut d'une carte se lit comme une heure de la
              journée. Il porte donc ce qu'il est : la durée de mouvement de
              ce seul secteur, arrêts exclus (ADR 010). Ce qui se lit vraiment
              comme une heure est la ligne d'en dessous, et elle le dit. */}
          <p className="shrink-0 text-right">
            <span className="block font-mono text-[13px] text-ink">
              {duree(leg.durationS)}
            </span>
            <span className="block text-[11px] text-ink-faint">
              de mouvement
            </span>
          </p>
        </div>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          <span className="font-mono">
            {km(startOf(roadbook.legs, index))} →{" "}
            {km(leg.endPositionM ?? totalM)} km
          </span>
          <span className="px-1.5 text-ink-faint">·</span>
          <span className="font-mono">
            +{entier(leg.ascentM)} m / −{entier(leg.descentM)} m
          </span>
        </p>
        {/* L'heure de passage quand la course a une heure de départ, le temps
            écoulé sinon : dans les deux cas, où l'on en est.
 
            Sur le premier secteur et sans heure de départ, le temps écoulé
            est la durée du secteur : la répéter en dessous n'apprend rien.
            L'heure de passage, elle, vaut dès le premier — c'est un nombre
            que la durée ne donne pas. */}
        <Releve
          className="mt-1 text-[12px]"
          items={[
            roadbook.startTime ? (
              <>
                passage vers{" "}
                <Val>{clockLabel(roadbook.startTime, leg.elapsedS)}</Val>
              </>
            ) : (
              leg.rank > 1 && (
                <>
                  <Val>{duree(leg.elapsedS)}</Val> depuis le départ
                </>
              )
            ),
            leg.stopS !== null && (
              <>
                <Val>{duree(leg.stopS)}</Val> d'arrêt
              </>
            ),
          ]}
        />
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {leg.imposedDurationS === null ? (
          <Button
            taille="sm"
            ton="contour"
            disabled={imposing}
            onClick={() => setDureeOuverte(!dureeOuverte)}
            aria-expanded={dureeOuverte}
            iconeFin={
              <ChevronIcon
                className={`size-3.5 text-ink-faint ${dureeOuverte ? "rotate-180" : ""}`}
              />
            }
          >
            imposer une durée
          </Button>
        ) : (
          <Tag ton="marque">
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
            ton="contour"
            disabled={imposing}
            onClick={() => setCibleOuverte(!cibleOuverte)}
            aria-expanded={cibleOuverte}
            iconeFin={
              <ChevronIcon
                className={`size-3.5 text-ink-faint ${cibleOuverte ? "rotate-180" : ""}`}
              />
            }
          >
            cible {entier(cibleGH)} g/h
          </Button>
        ) : (
          <Tag ton="marque">
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

      <div className="border-line border-b bg-paper-dim px-4 py-3">
        <p className="text-[14px] text-ink">
          Apport <Val>{entier(supply.carbsG)}</Val> g de glucides{" "}
          {ecart(supply.carbsG - leg.needG) !== "" && (
            <span
              className={trop ? "font-medium text-accent" : "text-ink-soft"}
            >
              ({ecart(supply.carbsG - leg.needG)}
              {trop ? ", au-dessus du besoin" : ""})
            </span>
          )}
        </p>
        <Releve
          className="mt-0.5"
          items={[
            <>
              <Val>{entier(supply.sodiumMg)}</Val> mg de sodium
              {ecart(supply.sodiumMg - leg.needSodiumMg, "mg", 5) && (
                <span className="text-ink-faint">
                  {" "}
                  ({ecart(supply.sodiumMg - leg.needSodiumMg, "mg", 5)})
                </span>
              )}
            </>,
            // Un secteur qui ouvre une portée annonce ce qu'il emporte, comme
            // les glucides et le sodium juste au-dessus annoncent leur apport.
            // Ailleurs, il n'y a rien à emporter : le besoin seul, sans écart.
            leg.opensLiquidSpan ? (
              <>
                liquide <Val>{entier(porte)}</Val> mL
                {ecart(porte - portee.besoinMl, "mL", 5) && (
                  <span className="text-ink-faint">
                    {" "}
                    ({ecart(porte - portee.besoinMl, "mL", 5)}
                    {surLaPortee ? " sur la portée" : ""})
                  </span>
                )}
              </>
            ) : (
              <>
                à boire <Val>{entier(leg.needFluidMl)}</Val> mL
              </>
            ),
          ]}
        />
      </div>

      <ul className="flex flex-col">
        {rations.length === 0 && (
          <li className="px-4 py-3 text-[13px] text-ink-faint">
            Rien de posé sur ce secteur.
          </li>
        )}

        {rations.map((r) => {
          const produit = produitDe(r.productSnapshotId);
          // Une boisson se retouche par flasque entière, et s'arrête là où
          // les flasques s'arrêtent : ce sont elles qui la portent.
          const pas = produit ? servingStep(produit, roadbook.flasks) : 1;
          const plafond = produit
            ? (flaskCapacityUnits(
                produit,
                roadbook.flasks,
                portee.remplissages,
              ) ?? undefined)
            : undefined;
          // Une boisson n'existe que dans une flasque, et les flasques d'une
          // portée sont à son ouverture. Sur un secteur qui n'en montre
          // aucune, la dose se lit mais ne se retouche pas : elle se change
          // là où on la prépare, et la retoucher d'ici la ferait sauter sur
          // l'autre carte sous les yeux du coureur.
          const preparee =
            !leg.opensLiquidSpan &&
            produit !== undefined &&
            produit.fluidMl > 0;

          return (
            <li
              key={r.productSnapshotId}
              className="flex items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0"
            >
              {preparee ? (
                <span className="flex w-[108px] shrink-0 flex-col items-center gap-0.5">
                  <span className="font-mono text-[15px] text-ink tabular-nums">
                    {quantite(r.quantity)}
                  </span>
                  <span className="flex w-full items-center justify-center gap-1 text-[11px] text-ink-faint">
                    <FlaskIcon className="size-3 shrink-0" />
                    {/* Un ravito peut porter un nom long : il se coupe plutôt
                        que de pousser la ligne du produit. */}
                    <span className="truncate">
                      {portee.ravito ?? "départ"}
                    </span>
                  </span>
                </span>
              ) : (
                <Stepper
                  value={r.quantity}
                  pas={pas}
                  max={plafond}
                  libelle={nomDe(r.productSnapshotId)}
                  onChange={(quantity) =>
                    onServing(r.productSnapshotId, quantity)
                  }
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink">
                  {produit ? nomProduit(produit.name) : r.productSnapshotId}
                </p>
                <p className="font-mono text-[11px] text-ink-soft">
                  {produit?.brandName}
                  {produit && (
                    <>
                      <span className="px-1.5 text-ink-faint">·</span>
                      {formatFr(produit.formatLabel)}
                      <span className="px-1.5 text-ink-faint">·</span>
                      {quantite(
                        Math.round(produit.carbsG * r.quantity * 10) / 10,
                      )}{" "}
                      g glucides
                      <span className="px-1.5 text-ink-faint">·</span>
                      {quantite(
                        Math.round(produit.sodiumMg * r.quantity * 10) / 10,
                      )}{" "}
                      mg sodium
                    </>
                  )}
                </p>
              </div>

              {!preparee && (
                <IconButton
                  libelle={`Retirer ${nomDe(r.productSnapshotId)} du secteur ${nom}`}
                  onClick={() => onServing(r.productSnapshotId, 0)}
                >
                  <CloseIcon className="size-4" />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>

      {/* Un ravito qui ne donne pas à manger ne suspend pas les prises : il
          déplace seulement le moment où on les charge. La ration reste donc
          modifiable ici — un solide n'a pas de contenant qui le borne — et la
          carte dit d'où elle sort. */}
      {!leg.opensSolidSpan &&
        rations.some((r) => solide(r.productSnapshotId)) && (
          <p className="border-line border-t px-4 py-2.5 text-[12px] text-ink-faint leading-relaxed">
            À prendre {lieu(priseSolide)} : ici le ravito ne donne pas à manger,
            ce qui se mange sort de la poche.
          </p>
        )}

      {absents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-line border-t px-4 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-ink-soft">
            <PlusIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">
              Ajouter un produit à ce secteur
            </span>
            <Select
              value=""
              aria-label={`Ajouter un produit au secteur ${nom}`}
              onChange={(event) => {
                if (event.target.value) onServing(event.target.value, 1);
              }}
            >
              <option value="">choisir dans le sac</option>
              {absents.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.brandName ?? ""} ${nomProduit(p.name)}`.trim()}
                </option>
              ))}
            </Select>
          </span>
        </div>
      )}

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
                  <Select
                    className="min-w-0 flex-1"
                    aria-label={`Contenu de la flasque ${flask.rank} au secteur ${nom}`}
                    value={
                      verse === undefined
                        ? "vide"
                        : (verse.productSnapshotId ?? "eau")
                    }
                    onChange={(event) => {
                      const v = event.target.value;
                      if (v === "vide") return onFill(flask.rank, null);

                      // Une flasque se remplit à ras bord : le roadbook ne
                      // retouche plus que son contenu, jamais son volume.
                      onFill(flask.rank, {
                        productSnapshotId: v === "eau" ? null : v,
                        volumeMl: flask.volumeMl,
                      });
                    }}
                  >
                    <option value="vide">rien</option>
                    <option value="eau">eau claire</option>
                    {!flask.onlyWater &&
                      versables.map((p) => (
                        <option key={p.id} value={p.id}>
                          {`${p.brandName ?? ""} ${nomProduit(p.name)}`.trim()}
                        </option>
                      ))}
                  </Select>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-faint leading-relaxed">
            {/* Une portée peut s'ouvrir au départ de la course, qui n'est pas
                un ravito : l'apposition ne suit que lorsqu'il y en a un. */}
            Pas de remplissage ici : les flasques se préparent {lieu(portee)}
            {portee.ravito !== null && ", dernier ravito qui donnait de l'eau"}.
            {rations.some((r) => !solide(r.productSnapshotId)) && (
              <>
                {" "}
                La boisson bue ici s'y verse avec, et c'est là qu'elle se
                change.
              </>
            )}
          </p>
        )}
        {leg.opensLiquidSpan &&
          versables.length === 0 &&
          roadbook.flasks.some((f) => !f.onlyWater) && (
            <p className="mt-2 text-[12px] text-ink-faint leading-relaxed">
              Rien à diluer dans le sac : les flasques ne prennent que de l'eau
              claire tant qu'aucune boisson n'est retenue sur l'écran Produits.
            </p>
          )}
      </div>

      {leg.warnings.length > 0 && (
        <div className={`flex flex-col gap-2 px-4 pb-3 ${vieux}`}>
          {leg.warnings.map((w) => (
            <Notice key={w.code}>{warningText(w.code, w.payload)}</Notice>
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
