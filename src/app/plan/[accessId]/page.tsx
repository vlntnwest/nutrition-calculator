import { RaceScreen } from "./_race/RaceScreen";
import { planOf, trackPointsOf, trackProfileOf } from "./plan";

/** Écran 3 — le chrono, la façon dont il se répartit, et les ravitos. */
export default async function Page(props: PageProps<"/plan/[accessId]">) {
  const { accessId } = await props.params;
  // La disposition a déjà rendu le 404 si le plan manque.
  // Le seul écran qui demande la trace entière : la carte la dessine, et les
  // curseurs d'allure relisent le profil à chaque geste.
  const [plan, points, profile] = await Promise.all([
    planOf(accessId),
    trackPointsOf(accessId),
    trackProfileOf(accessId),
  ]);
  if (!plan) return null;

  return (
    <RaceScreen
      accessId={accessId}
      plan={plan}
      points={points}
      profile={profile}
    />
  );
}
