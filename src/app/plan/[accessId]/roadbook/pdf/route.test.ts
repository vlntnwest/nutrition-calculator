import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createPlan } from "@/app/plans/createPlan";
import { newPlan as input } from "@/app/plans/newPlan.fixture";
import { regeneratePlan } from "@/app/plans/regeneratePlan";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { GET } from "./route";

/** Une tuile valide d'un pixel : le décodeur de react-pdf veut du vrai PNG. */
const TUILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const written: string[] = [];

beforeEach(() => {
  // Le fond de carte ne se télécharge pas ici : la politique d'usage
  // d'OpenStreetMap n'a pas à payer une suite qui tourne en boucle. Le reste
  // passe, car react-pdf va chercher le wasm de yoga par le même chemin.
  const vrai = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    async (entree: RequestInfo | URL, init?: RequestInit) =>
      String(entree).startsWith("https://tile.openstreetmap.org/")
        ? new Response(new Uint8Array(TUILE))
        : vrai(entree, init),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  while (written.length > 0) {
    await db.delete(plans).where(eq(plans.accessId, written.pop() as string));
  }
});

function appeler(accessId: string) {
  return GET(new Request(`http://localhost/plan/${accessId}/roadbook/pdf`), {
    params: Promise.resolve({ accessId }),
  });
}

test("un identifiant qui n'est pas un UUID n'a pas de feuille", async () => {
  expect((await appeler("pas-un-uuid")).status).toBe(404);
});

test("un plan inconnu n'a pas de feuille", async () => {
  expect((await appeler("00000000-0000-4000-8000-000000000000")).status).toBe(
    404,
  );
});

test("un plan jamais calculé n'a pas de feuille, et le dit", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);

  const reponse = await appeler(accessId);

  expect(reponse.status).toBe(404);
  expect(await reponse.text()).toContain("pas encore été calculé");
});

test("la feuille d'un plan calculé sort en PDF, nommée d'après la course", async () => {
  const accessId = await createPlan(input);
  written.push(accessId);
  await regeneratePlan(accessId);

  const reponse = await appeler(accessId);
  const corps = Buffer.from(await reponse.arrayBuffer());

  expect(reponse.status).toBe(200);
  expect(reponse.headers.get("Content-Type")).toBe("application/pdf");
  expect(reponse.headers.get("Content-Disposition")).toBe(
    'attachment; filename="saverne-trail_2026-10-11.pdf"',
  );
  expect(corps.subarray(0, 5).toString()).toBe("%PDF-");
  // Le nom de la course est écrit dans le document : la feuille rendue est
  // bien celle de ce plan, pas un PDF vide qui commencerait pareil.
  expect(corps.toString("latin1")).toContain("Saverne Trail");
});
