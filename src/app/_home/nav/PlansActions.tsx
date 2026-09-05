import { MyPlansLink } from "@/components/MyPlansLink";
import { OfficialPlansLink } from "@/components/OfficialPlansLink";

/**
 * Sous `lg`, une ligne à elles deux — jamais réduites au tiers en partageant
 * la ligne des cards. À partir de `lg`, une colonne étroite à droite des
 * cards, les deux tuiles superposées.
 */
export function PlansActions() {
  return (
    <div className="flex flex-wrap gap-4 lg:w-80 lg:flex-none lg:flex-col">
      <OfficialPlansLink />
      <MyPlansLink />
    </div>
  );
}
