import type { Roadbook } from "@/app/plans/roadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { nomProduit } from "@/format/produit";
import { FlaskIcon } from "@/ui/icons";
import { Select } from "@/ui/Select";
import { estVersable } from "../format";
import { estSolide, lieu, type Portee } from "./portee";

/**
 * Ce qu'on verse dans les flasques, au secteur qui ouvre la portée. Ailleurs,
 * elles ont été préparées en amont, et la carte renvoie à ce secteur-là.
 */
export function LegFlasks({
  leg,
  rations,
  remplissages,
  catalogue,
  flasks,
  portee,
  nom,
  vieux,
  onFill,
}: {
  leg: Roadbook["legs"][number];
  rations: RoadbookEdit["servings"][number];
  remplissages: RoadbookEdit["fills"][number];
  catalogue: Roadbook["catalogue"];
  flasks: Roadbook["flasks"];
  portee: Portee;
  /** Le secteur nommé par ses bornes, pour les libellés d'accessibilité. */
  nom: string;
  /** Les avertissements datent du dernier enregistrement. */
  vieux: string;
  onFill: (
    flaskRank: number,
    contenu: { productSnapshotId: string | null; volumeMl: number } | null,
  ) => void;
}) {
  // Ce qui se verse dans une flasque se dilue : une poudre, une pastille,
  // un liquide à couper. Une barre ne se verse pas, et le noyau qui reçoit
  // un solide en remplissage compte ses glucides comme bus. La liste ne
  // propose donc que ce qui se boit.
  const versables = catalogue.filter((p) => estVersable(p.formatLabel));

  return (
    <div className={`border-line border-t px-4 py-3 ${vieux}`}>
      {leg.opensLiquidSpan ? (
        <ul className="flex flex-col gap-2">
          {flasks.map((flask) => {
            const verse = remplissages.find((f) => f.flaskRank === flask.rank);

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
          {rations.some((r) => !estSolide(catalogue, r.productSnapshotId)) && (
            <>
              {" "}
              La boisson bue ici s'y verse avec, et c'est là qu'elle se change.
            </>
          )}
        </p>
      )}
      {leg.opensLiquidSpan &&
        versables.length === 0 &&
        flasks.some((f) => !f.onlyWater) && (
          <p className="mt-2 text-[12px] text-ink-faint leading-relaxed">
            Rien à diluer dans le sac : les flasques ne prennent que de l'eau
            claire tant qu'aucune boisson n'est retenue sur l'écran Produits.
          </p>
        )}
    </div>
  );
}
