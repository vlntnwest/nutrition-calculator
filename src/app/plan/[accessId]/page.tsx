import { CourseForm } from "./CourseForm";
import { planOf } from "./plan";

/** Écran 2 — le chrono, le coureur, les ravitos. */
export default async function Page(props: PageProps<"/plan/[accessId]">) {
  const { accessId } = await props.params;
  // La disposition a déjà rendu le 404 si le plan manque.
  const plan = await planOf(accessId);
  if (!plan) return null;

  return <CourseForm accessId={accessId} plan={plan} />;
}
