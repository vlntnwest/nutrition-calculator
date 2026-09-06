import { RaceScreen } from "./_race/RaceScreen";
import { planOf } from "./plan";

/** Écran 3 — le chrono, la façon dont il se répartit, et les ravitos. */
export default async function Page(props: PageProps<"/plan/[accessId]">) {
  const { accessId } = await props.params;
  // La disposition a déjà rendu le 404 si le plan manque.
  const plan = await planOf(accessId);
  if (!plan) return null;

  return <RaceScreen accessId={accessId} plan={plan} />;
}
