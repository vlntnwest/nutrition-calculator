import { expect, test } from "vitest";
import { getTrackPoints, getTrackProfile } from "./getTrack";

test("un identifiant qui n'est pas un UUID ne ramène aucune géométrie", async () => {
  expect(await getTrackPoints("pas-un-uuid")).toEqual([]);
  expect(await getTrackProfile("pas-un-uuid")).toEqual([]);
});
