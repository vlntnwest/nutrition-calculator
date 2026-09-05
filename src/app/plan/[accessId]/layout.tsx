import { notFound } from "next/navigation";
import { planOf } from "./plan";

/**
 * Le plan est lu ici pour savoir s'il existe encore : un identifiant inconnu
 * ou un plan expiré n'a pas d'écran, il a un 404. Les pages relisent, et
 * `cache` leur épargne la requête.
 */
export default async function Layout(props: LayoutProps<"/plan/[accessId]">) {
  const { accessId } = await props.params;
  const plan = await planOf(accessId);

  if (!plan) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {props.children}
    </div>
  );
}
