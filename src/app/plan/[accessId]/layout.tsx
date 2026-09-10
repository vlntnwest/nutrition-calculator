import { notFound } from "next/navigation";
import { destinations } from "./_shell/destinations";
import { PlanRail, PlanTabs } from "./_shell/PlanNav";
import { PlanTopBar } from "./_shell/PlanTopBar";
import { planOf, roadbookOf } from "./plan";

/**
 * La coquille des quatre destinations : le rail à gauche à partir de `lg`,
 * la barre d'onglets au pouce en dessous, l'identité de la course en haut.
 *
 * `fixed inset-0` plutôt que `h-dvh` : une hauteur de cent pour cent du
 * cadre laisse le document faire exactement la taille de l'écran, et un
 * navigateur mobile s'autorise à le faire glisser quand même pour replier sa
 * barre d'outils — la page entière ballottait sous le doigt. Posée en fixe,
 * la coquille sort du flux, le document n'a plus de hauteur du tout, et il
 * ne reste à défiler que ce que chaque écran défile lui-même.
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
    <div className="fixed inset-0 flex overflow-hidden overscroll-none bg-paper text-ink">
      <PlanRail accessId={accessId} items={items} />

      <div className="flex min-w-0 flex-1 flex-col">
        <PlanTopBar
          accessId={accessId}
          nom={plan.track.name}
          distanceM={plan.track.distanceM}
          ascentM={plan.track.ascentM}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[61.5px] lg:pb-0">
          {props.children}
        </main>
      </div>

      <PlanTabs accessId={accessId} items={items} />
    </div>
  );
}
