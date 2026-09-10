"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadPlanSummaries } from "@/app/plans/actions";
import { forgetPlan, storedPlans } from "@/app/plans/stored";
import type { PlanSummary } from "@/app/plans/summaries";
import { shortDate } from "@/format/date";
import { entier, km } from "@/format/number";
import { SpinnerIcon } from "@/ui/icons";
import { Val } from "@/ui/Measure";
import { EmptyNote, ErrorNote } from "@/ui/Notice";
import { Onglet } from "@/ui/Panel";

type Etat =
  | { kind: "lecture" }
  | { kind: "liste"; plans: PlanSummary[] }
  | { kind: "erreur"; message: string };

/**
 * Les plans retenus par cet appareil, avec de quoi les distinguer : la
 * course, ce qu'elle mesure, la dernière sauvegarde et le jour où le plan
 * s'efface.
 *
 * La liste vient du navigateur, le relevé de la base : le premier ne garde
 * que des identifiants (§ ADR 003), et un identifiant ne dit pas de quelle
 * course il parle. D'où la lecture après le montage, `localStorage` n'ayant
 * pas d'existence côté serveur.
 *
 * Un plan que la base ne rend pas a expiré ou n'existe plus : l'appareil
 * l'oublie sur place, sans quoi la ligne reviendrait à chaque visite.
 */
export function StoredPlansTable() {
  const [etat, setEtat] = useState<Etat>({ kind: "lecture" });

  useEffect(() => {
    const ids = storedPlans();

    if (ids.length === 0) {
      setEtat({ kind: "liste", plans: [] });

      return;
    }

    let monte = true;

    void loadPlanSummaries(ids).then((result) => {
      if (!monte) return;

      if (!result.ok) {
        setEtat({ kind: "erreur", message: result.error });

        return;
      }

      const parId = new Map(result.value.map((plan) => [plan.accessId, plan]));

      for (const id of ids) {
        if (!parId.has(id)) forgetPlan(id);
      }

      // L'ordre de l'appareil, le dernier ouvert en tête. La base rend ses
      // lignes dans l'ordre qui l'arrange.
      setEtat({
        kind: "liste",
        plans: ids
          .map((id) => parId.get(id))
          .filter((plan) => plan !== undefined),
      });
    });

    return () => {
      monte = false;
    };
  }, []);

  if (etat.kind === "lecture") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-soft">
        <SpinnerIcon className="size-4" />
        Lecture des plans de cet appareil
      </p>
    );
  }

  if (etat.kind === "erreur") return <ErrorNote>{etat.message}</ErrorNote>;

  if (etat.plans.length === 0) {
    return (
      <EmptyNote titre="Aucun plan sur cet appareil">
        Un plan se retient au moment où il s'ouvre. Importez un GPX, ou partez
        d'une course officielle.
      </EmptyNote>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="font-mono text-[10px] text-ink-soft uppercase tracking-[0.14em]">
        {etat.plans.length} plan{etat.plans.length > 1 ? "s" : ""}
      </p>

      {/* Cinq colonnes ne tiennent pas dans la largeur d'un téléphone, et
          aucune n'est décorative : le tableau défile de côté plutôt que de
          laisser tomber une date. */}
      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-paper">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-line border-b">
              <Colonne>course</Colonne>
              <Colonne aligne>distance</Colonne>
              <Colonne aligne>dénivelé</Colonne>
              <Colonne>dernière sauvegarde</Colonne>
              <Colonne>expire le</Colonne>
            </tr>
          </thead>

          <tbody>
            {etat.plans.map((plan) => (
              <tr
                key={plan.accessId}
                className="border-line border-b transition-colors last:border-b-0 hover:bg-paper-dim"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/plan/${plan.accessId}`}
                    className="font-medium text-[14px] text-ink transition-colors hover:text-accent"
                  >
                    {plan.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-[13px]">
                  <Val unite="km">{km(plan.distanceM)}</Val>
                </td>
                <td className="px-4 py-3 text-right text-[13px]">
                  <Val unite="m">{entier(plan.ascentM)}</Val>
                </td>
                <td className="px-4 py-3 font-mono text-[13px] text-ink-soft">
                  {shortDate(plan.lastSavedAt)}
                </td>
                <td className="px-4 py-3 font-mono text-[13px] text-ink-soft">
                  {plan.expiresAt ? shortDate(plan.expiresAt) : "sans terme"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** L'en-tête d'une colonne : une étiquette de relevé, jamais un titre. */
function Colonne({
  children,
  aligne = false,
}: {
  children: string;
  aligne?: boolean;
}) {
  return (
    <th scope="col" className={`px-4 py-2.5 ${aligne ? "text-right" : ""}`}>
      <Onglet>{children}</Onglet>
    </th>
  );
}
