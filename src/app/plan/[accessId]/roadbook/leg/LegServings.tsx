import type { Roadbook } from "@/app/plans/roadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { quantite } from "@/format/number";
import { formatFr, nomProduit } from "@/format/produit";
import { IconButton } from "@/ui/Button";
import { CloseIcon, FlaskIcon, PlusIcon } from "@/ui/icons";
import { Select } from "@/ui/Select";
import { Stepper } from "@/ui/Stepper";
import { flaskCapacityUnits, servingStep } from "../edit";
import {
  estSolide,
  lieu,
  nomDe,
  type Portee,
  type PriseSolide,
  produitDe,
} from "./portee";

/** Ce qu'on prend sur ce secteur, et de quoi y ajouter. */
export function LegServings({
  leg,
  rations,
  catalogue,
  flasks,
  portee,
  priseSolide,
  nom,
  onServing,
}: {
  leg: Roadbook["legs"][number];
  rations: RoadbookEdit["servings"][number];
  catalogue: Roadbook["catalogue"];
  flasks: Roadbook["flasks"];
  portee: Portee;
  priseSolide: PriseSolide;
  /** Le secteur nommé par ses bornes, pour les libellés d'accessibilité. */
  nom: string;
  onServing: (snapshotId: string, quantity: number) => void;
}) {
  // Une boisson ne se pose que là où une flasque la verse : sur un secteur au
  // milieu d'une portée, le menu ne la propose pas — elle se choisirait ici
  // pour apparaître sur la carte d'à côté.
  const absents = catalogue.filter(
    (p) =>
      !rations.some((r) => r.productSnapshotId === p.id) &&
      (leg.opensLiquidSpan || p.fluidMl === 0),
  );

  return (
    <>
      <ul className="flex flex-col">
        {rations.length === 0 && (
          <li className="px-4 py-3 text-[13px] text-ink-faint">
            Rien de posé sur ce secteur.
          </li>
        )}

        {rations.map((r) => {
          const produit = produitDe(catalogue, r.productSnapshotId);
          // Une boisson se retouche par flasque entière, et s'arrête là où
          // les flasques s'arrêtent : ce sont elles qui la portent.
          const pas = produit ? servingStep(produit, flasks) : 1;
          const plafond = produit
            ? (flaskCapacityUnits(produit, flasks, portee.remplissages) ??
              undefined)
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
                  libelle={nomDe(catalogue, r.productSnapshotId)}
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
                  libelle={`Retirer ${nomDe(catalogue, r.productSnapshotId)} du secteur ${nom}`}
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
        rations.some((r) => estSolide(catalogue, r.productSnapshotId)) && (
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
    </>
  );
}
