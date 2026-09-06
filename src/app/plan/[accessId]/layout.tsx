import { notFound } from "next/navigation";
import { destinations } from "./_shell/destinations";
import { PlanRail, PlanTabs } from "./_shell/PlanNav";
import { PlanTopBar } from "./_shell/PlanTopBar";
import { planOf, roadbookOf } from "./plan";

/**
 * La coquille des quatre destinations : le rail à gauche à partir de `lg`,
 * la barre d'onglets au pouce en dessous, l'identité de la course en haut.
 *
 * Le plan est lu ici pour savoir s'il existe encore : un identifiant inconnu
 * ou un plan expiré n'a pas d'écran, il a un 404. Les pages relisent, et
 * `cache` leur épargne la requête.
 */
export default async function Layout(props: LayoutProps<"/plan/[accessId]">) {
  const { accessId } = await props.params;
  const [plan, roadbook] = await Promise.all([
    planOf(accessId),
    roadbookOf(accessId),
  ]);

  if (!plan) notFound();

  const items = destinations(plan, roadbook !== null);

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <PlanRail accessId={accessId} items={items} />

      <div className="flex min-w-0 flex-1 flex-col">
        <PlanTopBar
          nom={plan.track.name}
          distanceM={plan.track.distanceM}
          ascentM={plan.track.ascentM}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[4.75rem] lg:pb-0">
          {props.children}
        </main>
      </div>

      <PlanTabs accessId={accessId} items={items} />
    </div>
  );
}
