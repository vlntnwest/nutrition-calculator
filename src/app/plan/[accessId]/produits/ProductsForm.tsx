"use client";

import { useMemo, useState } from "react";
import type { CatalogueEntry } from "@/app/plans/catalogue";
import type { Targets } from "@/core/type";
import { formatPluriel } from "@/format/produit";
import { Button } from "@/ui/Button";
import { FilterChip, ToggleChip } from "@/ui/Chip";
import { ChevronIcon, CloseIcon, SearchIcon } from "@/ui/icons";
import { EmptyNote, ErrorNote } from "@/ui/Notice";
import { Pagination } from "@/ui/Pagination";
import { Rule } from "@/ui/Panel";
import { SaveBar } from "@/ui/SaveBar";
import { usePlanSave } from "../save";
import {
  aucunFiltre,
  bascule,
  FILTRES_VIDES,
  type Filtres,
  filtrer,
  PALIERS,
} from "./filtres";
import { ProductCard } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";

/** Le nombre de fiches par page : un compte rond sur deux, trois et quatre
 * colonnes, pour que la dernière ligne ne se retrouve jamais orpheline. */
const PAR_PAGE = 24;

/**
 * Écran Produits : le catalogue entier, et ce qu'on en retient pour cette
 * course. Le plan ne fige les valeurs nutritionnelles qu'à l'enregistrement,
 * en instantané ; corriger le catalogue ensuite ne réécrit rien.
 */
export function ProductsForm({
  accessId,
  catalogue,
  choisis,
  cibles,
}: {
  accessId: string;
  catalogue: CatalogueEntry[];
  choisis: string[];
  cibles: Targets | undefined;
}) {
  const [retenus, setRetenus] = useState(new Set(choisis));
  const [filtres, setFiltresBrut] = useState<Filtres>(FILTRES_VIDES);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [modifie, setModifie] = useState(false);
  const [page, setPage] = useState(1);
  const { pending, erreur, enregistre, save, reprise } = usePlanSave(accessId);

  /** Un filtre qui bouge rouvre toujours sur la première page. */
  function setFiltres(suite: Filtres) {
    setFiltresBrut(suite);
    setPage(1);
  }

  const formats = useMemo(
    () => [...new Set(catalogue.map((p) => p.formatLabel))].sort(),
    [catalogue],
  );
  const marques = useMemo(
    () => [...new Set(catalogue.map((p) => p.brandName))].sort(),
    [catalogue],
  );
  const gardes = useMemo(
    () => filtrer(catalogue, filtres),
    [catalogue, filtres],
  );
  // Une page qui n'existe plus une fois les filtres resserrés retombe sur la
  // dernière valide, plutôt que de laisser la grille vide sous une pagination
  // qui pointe dans le vide.
  const pages = Math.max(1, Math.ceil(gardes.length / PAR_PAGE));
  const pageActuelle = Math.min(page, pages);
  const visibles = gardes.slice(
    (pageActuelle - 1) * PAR_PAGE,
    pageActuelle * PAR_PAGE,
  );
  const detaille = catalogue.find((p) => p.codeSeed === ouvert);

  function basculer(codeSeed: string) {
    const suite = new Set(retenus);
    if (!suite.delete(codeSeed)) suite.add(codeSeed);
    setRetenus(suite);
    setModifie(true);
    reprise();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-line border-b bg-paper px-4 pt-4 pb-3 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-semibold text-[22px] text-ink tracking-tight">
            Produits
          </h2>
          {/* La taille du catalogue ne sert à rien au coureur : ce qu'il
              vient vérifier ici, c'est ce qu'il a déjà retenu. Le compte de
              résultats filtrés vit plus bas, à côté des filtres eux-mêmes. */}
          <p className="font-mono text-[12px] text-ink-soft">
            {retenus.size} dans le sac
          </p>
        </div>

        <div className="mt-3 flex max-w-xl items-center gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-paper px-3 transition-colors focus-within:border-accent">
            <SearchIcon className="size-4 shrink-0 text-ink-faint" />
            <input
              value={filtres.recherche}
              onChange={(event) =>
                setFiltres({ ...filtres, recherche: event.target.value })
              }
              placeholder="Chercher un gel, une boisson, une purée"
              className="w-full bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-faint"
            />
            {filtres.recherche !== "" && (
              <button
                type="button"
                onClick={() => setFiltres({ ...filtres, recherche: "" })}
                aria-label="Vider la recherche"
                className="cursor-pointer text-ink-faint hover:text-ink"
              >
                <CloseIcon className="size-4" />
              </button>
            )}
          </label>

          <Button
            ton="discret"
            taille="sm"
            onClick={() => setFiltresOuverts(!filtresOuverts)}
            aria-expanded={filtresOuverts}
            iconeFin={
              <ChevronIcon
                className={`size-3.5 text-ink-faint transition-transform ${filtresOuverts ? "rotate-180" : ""}`}
              />
            }
          >
            Filtrer
          </Button>
        </div>

        {filtresOuverts && (
          <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius-panel)] border border-line bg-paper-dim p-3">
            <Facette nom="Format">
              {formats.map((format) => (
                <ToggleChip
                  key={format}
                  actif={filtres.formats.includes(format)}
                  onChange={() =>
                    setFiltres({
                      ...filtres,
                      formats: bascule(filtres.formats, format),
                    })
                  }
                >
                  {formatPluriel(format)}
                </ToggleChip>
              ))}
            </Facette>

            <Rule />

            <Facette nom="Marque">
              {marques.map((marque) => (
                <ToggleChip
                  key={marque}
                  actif={filtres.marques.includes(marque)}
                  onChange={() =>
                    setFiltres({
                      ...filtres,
                      marques: bascule(filtres.marques, marque),
                    })
                  }
                >
                  {marque}
                </ToggleChip>
              ))}
            </Facette>

            <Rule />

            <Facette nom="Glucides par dose">
              {PALIERS.map((palier) => (
                <ToggleChip
                  key={palier.id}
                  actif={filtres.palier === palier.id}
                  onChange={(actif) =>
                    setFiltres({ ...filtres, palier: actif ? palier.id : null })
                  }
                >
                  {palier.nom}
                </ToggleChip>
              ))}
            </Facette>
          </div>
        )}

        <div
          className={`flex-wrap items-center gap-2 py-2.5 ${aucunFiltre(filtres) ? "hidden" : "flex"}`}
        >
          {filtres.formats.map((format) => (
            <FilterChip
              key={format}
              onRemove={() =>
                setFiltres({
                  ...filtres,
                  formats: bascule(filtres.formats, format),
                })
              }
            >
              {formatPluriel(format)}
            </FilterChip>
          ))}
          {filtres.marques.map((marque) => (
            <FilterChip
              key={marque}
              onRemove={() =>
                setFiltres({
                  ...filtres,
                  marques: bascule(filtres.marques, marque),
                })
              }
            >
              {marque}
            </FilterChip>
          ))}
          {filtres.palier && (
            <FilterChip
              onRemove={() => setFiltres({ ...filtres, palier: null })}
            >
              {PALIERS.find((p) => p.id === filtres.palier)?.nom ?? ""}
            </FilterChip>
          )}

          <span className="ml-auto font-mono text-[11px] text-ink-soft">
            {gardes.length} résultat{gardes.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        {gardes.length === 0 ? (
          <EmptyNote titre="Rien ne correspond">
            Aucun produit du catalogue ne passe ces filtres. Retirez-en un, ou
            videz la recherche.
          </EmptyNote>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((produit) => (
                <ProductCard
                  key={produit.codeSeed}
                  produit={produit}
                  dansLeSac={retenus.has(produit.codeSeed)}
                  onOuvrir={() => setOuvert(produit.codeSeed)}
                  onBasculer={() => basculer(produit.codeSeed)}
                />
              ))}
            </div>

            <div className="mt-5">
              <Pagination
                page={pageActuelle}
                total={pages}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* `paper-dim` fait de ce pied un plateau creux, pas une bande
          blanche posée sur le papier : le bouton s'y pose, il n'y flotte
          plus seul. Même creux que `Panel ton="creux"`. */}
      <div className="shrink-0 border-line border-t bg-paper-dim px-4 sm:px-6">
        {erreur && <ErrorNote>{erreur}</ErrorNote>}

        <SaveBar
          pending={pending}
          modifie={modifie}
          enregistre={enregistre && !modifie}
          consequence="le roadbook devra être recalculé"
          onSave={() =>
            save({ productCodes: [...retenus] }, () => setModifie(false))
          }
        />
      </div>

      {detaille && (
        <ProductSheet
          produit={detaille}
          dansLeSac={retenus.has(detaille.codeSeed)}
          cibles={cibles}
          onBasculer={() => basculer(detaille.codeSeed)}
          onFermer={() => setOuvert(null)}
        />
      )}
    </div>
  );
}

function Facette({
  nom,
  children,
}: {
  nom: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em] sm:w-32">
        {nom}
      </span>
      {children}
    </div>
  );
}
