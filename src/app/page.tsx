import { HomeScreen } from "./_home/HomeScreen";
import { listOfficialRaces } from "./plans/officialRaces";

export default async function Page() {
  return <HomeScreen races={await listOfficialRaces()} />;
}
