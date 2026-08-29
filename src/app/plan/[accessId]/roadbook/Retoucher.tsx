"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveEditedRoadbook } from "@/app/plans/actions";
import type { Roadbook } from "@/app/plans/getRoadbook";
import type { RoadbookEdit } from "@/app/plans/saveRoadbook";
import { borne, duree, ecart } from "./format";

/** Le plan affiché, ramené à ce qui se retouche. */
function editOf(roadbook: Roadbook): RoadbookEdit {
  return {
    servings: roadbook.legs.map((leg) =>
      leg.servings.map((s) => ({
        productSnapshotId: s.productSnapshotId,
        quantity: s.quantity,
      })),
    ),
    fills: roadbook.legs.map((leg) =>
      leg.fills.map((f) => ({
        flaskRank: f.flaskRank,
        productSnapshotId: f.productSnapshotId,
        volumeMl: f.volumeMl,
      })),
    ),
  };
}

export function Retoucher({
  accessId,
  roadbook,
  totalM,
}: {
  accessId: string;
  roadbook: Roadbook;
  totalM: number;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(() => editOf(roadbook));
  const [sale, setSale] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const produit = (id: string) => roadbook.catalogue.find((p) => p.id === id);
  const nomme = (id: string) => {
    const p = produit(id);

    return p ? `${p.brandName ?? ""} ${p.name}`.trim() : id;
  };

  /** Pose une quantité sur un secteur. À zéro, la ration disparaît. */
  function poser(leg: number, snapshotId: string, quantity: number) {
    setSale(true);
    setEdit((e) => ({
      ...e,
      servings: e.servings.map((rations, l) => {
        if (l !== leg) return rations;
        const reste = rations.filter((r) => r.productSnapshotId !== snapshotId);

        return quantity > 0
          ? [...reste, { productSnapshotId: snapshotId, quantity }]
          : reste;
      }),
    }));
  }

  /** Verse — ou vide — une flasque sur un secteur. */
  function verser(
    leg: number,
    flaskRank: number,
    contenu: { productSnapshotId: string | null; volumeMl: number } | null,
  ) {
    setSale(true);
    setEdit((e) => ({
      ...e,
      fills: e.fills.map((remplissages, l) => {
        if (l !== leg) return remplissages;
        const reste = remplissages.filter((f) => f.flaskRank !== flaskRank);

        return contenu === null ? reste : [...reste, { flaskRank, ...contenu }];
      }),
    }));
  }

  function enregistrer() {
    setErreur(null);
    start(async () => {
      const result = await saveEditedRoadbook(accessId, edit);
      if (result.ok) {
        setSale(false);
        // Comme Calculer : c'est le rendu du serveur qu'il faut refaire.
        router.refresh();
      } else {
        setErreur(result.error);
      }
    });
  }

  // Les chiffres agrégés viennent du serveur : tant qu'on n'a pas enregistré,
  // ils décrivent l'état d'avant. On les estompe plutôt que de les resommer
  // ici — ce serait rouvrir la divergence que getRoadbook évite. ADR 011.
  const vieux = sale ? "opacity-50" : "";

  return (
    <>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="border px-3 py-1 font-semibold"
          disabled={!sale || pending}
          onClick={enregistrer}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {sale && (
          <p className="text-sm">
            Chiffres du dernier enregistrement — ils se mettront à jour.
          </p>
        )}
        {erreur && <p role="alert">{erreur}</p>}
      </div>

      {roadbook.warnings.length > 0 && (
        <ul className={`flex flex-col gap-1 ${vieux}`} role="alert">
          {roadbook.warnings.map((w) => (
            <li key={w.code}>⚠ {w.code}</li>
          ))}
        </ul>
      )}

      <ol className="flex flex-col gap-4">
        {roadbook.legs.map((leg, l) => {
          const rations = edit.servings[l];
          const absents = roadbook.catalogue.filter(
            (p) => !rations.some((r) => r.productSnapshotId === p.id),
          );

          return (
            <li key={leg.rank} className="flex flex-col gap-1 border-t pt-2">
              <h3 className="font-semibold">
                Secteur {leg.rank} — jusqu'à {borne(leg, totalM)}
              </h3>
              <p className="text-sm">
                {duree(leg.durationS)} · +{leg.ascentM} m / −{leg.descentM} m
              </p>

              <ul className="text-sm">
                {rations.map((r) => {
                  const pas =
                    1 / (produit(r.productSnapshotId)?.divisibleBy ?? 1);

                  return (
                    <li
                      key={r.productSnapshotId}
                      className="flex items-center gap-2"
                    >
                      <span>
                        {r.quantity} × {nomme(r.productSnapshotId)}
                      </span>
                      <button
                        type="button"
                        className="border px-2"
                        aria-label={`Retirer ${pas} de ${nomme(r.productSnapshotId)}`}
                        onClick={() =>
                          poser(l, r.productSnapshotId, r.quantity - pas)
                        }
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="border px-2"
                        aria-label={`Ajouter ${pas} de ${nomme(r.productSnapshotId)}`}
                        onClick={() =>
                          poser(l, r.productSnapshotId, r.quantity + pas)
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="border px-2"
                        onClick={() => poser(l, r.productSnapshotId, 0)}
                      >
                        retirer
                      </button>
                    </li>
                  );
                })}
              </ul>

              {absents.length > 0 && (
                <select
                  className="border px-2 py-1 text-sm"
                  value=""
                  aria-label={`Ajouter un produit au secteur ${leg.rank}`}
                  onChange={(e) => {
                    if (e.target.value) poser(l, e.target.value, 1);
                  }}
                >
                  <option value="">Ajouter un produit…</option>
                  {absents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${p.brandName ?? ""} ${p.name}`.trim()}
                    </option>
                  ))}
                </select>
              )}

              <p className={`text-sm ${vieux}`}>
                Apport : {Math.round(leg.supply.carbsG)} g de glucides
                {ecart(leg.marginG)} ·{" "}
                {Math.round(leg.supply.energyKcal).toLocaleString("fr")} kcal ·{" "}
                {Math.round(leg.supply.sodiumMg)} mg de sodium ·{" "}
                {Math.round(leg.supply.fluidMl)} mL de boisson
              </p>

              <p className={`text-sm ${vieux}`}>
                À boire : {Math.round(leg.needFluidMl)} mL
              </p>

              <ul className="text-sm">
                {roadbook.flasks.map((flask) => {
                  const verse = edit.fills[l].find(
                    (f) => f.flaskRank === flask.rank,
                  );

                  return (
                    <li
                      key={flask.rank}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <span>
                        Flasque {flask.rank} ({flask.volumeMl} mL)
                      </span>
                      <select
                        className="border px-1"
                        aria-label={`Flasque ${flask.rank} du secteur ${leg.rank}`}
                        value={
                          verse === undefined
                            ? "vide"
                            : (verse.productSnapshotId ?? "eau")
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "vide") return verser(l, flask.rank, null);

                          verser(l, flask.rank, {
                            productSnapshotId: v === "eau" ? null : v,
                            volumeMl: verse?.volumeMl ?? flask.volumeMl,
                          });
                        }}
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
                          className="w-20 border px-1"
                          min={1}
                          step={10}
                          value={verse.volumeMl}
                          aria-label={`Volume de la flasque ${flask.rank} au secteur ${leg.rank}`}
                          onChange={(e) =>
                            verser(l, flask.rank, {
                              productSnapshotId: verse.productSnapshotId,
                              volumeMl: Number(e.target.value),
                            })
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className={vieux}>
                {leg.warnings.map((w) => (
                  <p key={w.code} className="text-sm">
                    ⚠ {w.code}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      <section className={`flex flex-col gap-1 border-t pt-2 ${vieux}`}>
        <h3 className="font-semibold">Le sac complet</h3>
        <ul className="text-sm">
          {roadbook.total.units.map((u) => (
            <li key={u.name}>
              {u.quantity} × {u.brandName} {u.name}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          {Math.round(roadbook.total.carbsG)} g de glucides
          {ecart(roadbook.total.marginG)} ·{" "}
          {Math.round(roadbook.total.energyKcal).toLocaleString("fr")} kcal ·{" "}
          {Math.round(roadbook.total.sodiumMg)} mg de sodium ·{" "}
          {Math.round(roadbook.total.fluidMl)} mL de boisson
        </p>
      </section>
    </>
  );
}
