import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { LegCard } from "./LegCard";
import { leg, roadbook } from "./roadbook.fixture";

type Props = Parameters<typeof LegCard>[0];

/**
 * La carte rendue, avec de quoi la rendre : le reste de ses seize entrées se
 * déduit du secteur qu'on lui donne. Les rappels ne font rien — ce qui
 * s'observe ici est ce que la carte montre, pas ce qu'elle renvoie.
 *
 * `renderToStaticMarkup` plutôt qu'un DOM d'essai : la carte n'a pas d'effet
 * et ne lit rien du navigateur, son premier rendu suffit donc à la décrire,
 * et `react-dom` est déjà là.
 */
function rendre(patch: Partial<Props> = {}): string {
  const plan = patch.roadbook ?? roadbook();
  const secteur = patch.leg ?? plan.legs[0];

  return renderToStaticMarkup(
    <LegCard
      leg={secteur}
      index={0}
      rations={[]}
      remplissages={[]}
      roadbook={plan}
      cibleGH={60}
      portee={{
        rank: secteur.rank,
        ravito: null,
        besoinMl: secteur.needFluidMl,
        remplissages: [],
      }}
      priseSolide={{ rank: secteur.rank, ravito: null }}
      totalM={plan.totalM}
      vieux=""
      onServing={() => {}}
      onFill={() => {}}
      onImposerDuree={() => {}}
      onImposerCible={() => {}}
      imposing={false}
      {...patch}
    />,
  );
}

/** Ce que la carte donne à lire, balises ôtées. */
function texte(patch: Partial<Props> = {}): string {
  return rendre(patch).replace(/<[^>]*>/g, "");
}

test("la carte se nomme par ses deux bornes", () => {
  const lu = texte({
    roadbook: roadbook({
      legs: [leg({ endName: "Ravito Haberacker" }), leg({ rank: 2 })],
    }),
  });

  expect(lu).toContain("Départ");
  expect(lu).toContain("Ravito Haberacker");
});

test("l'en-tête porte la durée de mouvement, les bornes et le relief", () => {
  const lu = texte({
    leg: leg({ durationS: 4500, ascentM: 420, descentM: 180 }),
  });

  expect(lu).toContain("1 h 15");
  expect(lu).toContain("de mouvement");
  expect(lu).toContain("0,0 → 9,8 km");
  expect(lu).toContain("+420 m / −180 m");
});

/**
 * Sans heure de départ, le premier secteur ne répète pas sa propre durée : le
 * temps écoulé y vaut la durée, et le redire n'apprend rien.
 */
test("l'heure de passage remplace le temps écoulé quand la course en a une", () => {
  expect(texte({ roadbook: roadbook({ startTime: "05:30" }) })).toContain(
    "passage vers",
  );

  const sansHeure = texte();

  expect(sansHeure).not.toContain("passage vers");
  expect(sansHeure).not.toContain("depuis le départ");
});

test("l'apport se lit avec son écart à la cible", () => {
  const lu = texte({ rations: [{ productSnapshotId: "gel-1", quantity: 2 }] });

  expect(lu).toContain("50 g de glucides");
  expect(lu).toContain("(−25 g)");
  expect(lu).toContain("100 mg de sodium");
});

test("une ration porte son produit, sa marque et son format", () => {
  const lu = texte({ rations: [{ productSnapshotId: "gel-1", quantity: 2 }] });

  expect(lu).toContain("Gel citron");
  expect(lu).toContain("Marque");
  expect(lu).toContain("gel");
});

/**
 * Une boisson ne se pose que là où une flasque la verse : au milieu d'une
 * portée, le menu d'ajout ne la propose pas — elle se choisirait ici pour
 * apparaître sur la carte d'à côté.
 */
test("le menu d'ajout ne propose une boisson qu'à l'ouverture d'une portée", () => {
  const ouvert = texte({ leg: leg({ opensLiquidSpan: true }) });

  expect(ouvert).toContain("Boisson orange");
  expect(ouvert).toContain("Gel citron");

  const ferme = texte({ leg: leg({ opensLiquidSpan: false }) });

  expect(ferme).not.toContain("Boisson orange");
  expect(ferme).toContain("Gel citron");
});

test("une ration déjà posée sort du menu d'ajout", () => {
  const lu = rendre({ rations: [{ productSnapshotId: "gel-1", quantity: 1 }] });
  const options = [...lu.matchAll(/<option[^>]*>([^<]*)</g)].map((m) => m[1]);

  expect(options).not.toContain("Marque Gel citron");
});

/**
 * Les flasques ne se préparent qu'au secteur qui ouvre la portée : ailleurs
 * elles l'ont été en amont, et la carte renvoie à ce secteur-là.
 */
test("les flasques ne se versent qu'à l'ouverture de la portée", () => {
  const lu = texte({ leg: leg({ opensLiquidSpan: true }) });

  expect(lu).toContain("Flasque 1");
  expect(lu).toContain("Flasque 2");
  expect(lu).toContain("eau claire");
});

test("un secteur sans ration le dit au lieu de laisser un vide", () => {
  expect(texte()).toContain("Rien de posé sur ce secteur.");
});

test("une consigne de durée se lit sur la carte", () => {
  expect(texte({ leg: leg({ imposedDurationS: 4920 }) })).toContain("1 h 22");
});

test("une cible imposée se lit sur la carte", () => {
  expect(texte({ leg: leg({ imposedCarbsGH: 90 }), cibleGH: 90 })).toContain(
    "90",
  );
});

/** Un code d'avertissement ne doit jamais sortir tel quel à l'écran. */
test("un avertissement de secteur s'écrit en toutes lettres", () => {
  const secteur = leg({
    warnings: [{ code: "leg-fluid-above-target", payload: {} }],
  });

  const lu = texte({ leg: secteur, roadbook: roadbook({ legs: [secteur] }) });

  expect(lu).not.toContain("leg-fluid-above-target");
  expect(lu).toContain("Le surplus se boira ailleurs");
});
