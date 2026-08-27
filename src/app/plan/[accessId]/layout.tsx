import Link from "next/link";
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

  const onglets = [
    { href: `/plan/${accessId}`, texte: "Course" },
    { href: `/plan/${accessId}/produits`, texte: "Produits" },
    { href: `/plan/${accessId}/roadbook`, texte: "Roadbook" },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline">
          ← Nouvel import
        </Link>
        <h1 className="text-2xl font-semibold">{plan.track.name}</h1>
        <p className="text-sm">
          {(plan.track.distanceM / 1000).toFixed(1)} km · {plan.track.ascentM} m
          D+
        </p>
        <nav className="flex gap-4 text-sm">
          {onglets.map((o) => (
            <Link key={o.href} href={o.href} className="underline">
              {o.texte}
            </Link>
          ))}
        </nav>
      </header>

      {props.children}
    </div>
  );
}
