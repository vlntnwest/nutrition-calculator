import { Line, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { ProfileFigure } from "./profile";
import { GRILLE, INK, INK_SOFT, LINE, RELIEF } from "./styles";

/** Ce que les graduations prennent de part et d'autre du relief, en points. */
const GOUTTIERE_G = 40;
const GOUTTIERE_D = 38;
/** Le bandeau des repères en haut, les distances et leur titre en bas. */
const REPERES = 9;
const DISTANCES = 9;
const TITRE_BAS = 9;

/**
 * Le relief et la bande d'allure, superposés sur toute la hauteur du cadre.
 *
 * Les deux figures partagent une seule grille : l'altitude se lit à droite,
 * l'allure à gauche, sur les mêmes lignes. C'est la disposition du PacePro
 * des montres de course, et c'est ce qui rend la superposition lisible — deux
 * grilles concurrentes donneraient un quadrillage illisible.
 *
 * Les légendes sont du texte de mise en page, pas du texte SVG : à cette
 * taille, une police mise à l'échelle par une `viewBox` rend des épaisseurs
 * de trait inégales.
 */
export function SheetProfile({
  figure,
  largeurPt,
  hauteurPt,
}: {
  figure: ProfileFigure;
  largeurPt: number;
  hauteurPt: number;
}) {
  const cadreL = largeurPt - GOUTTIERE_G - GOUTTIERE_D;
  const cadreH = hauteurPt - REPERES - DISTANCES - TITRE_BAS;
  const versX = (x: number) => (x / figure.cadre.largeur) * cadreL;
  const versY = (y: number) => (y / figure.cadre.hauteur) * cadreH;

  const legende = {
    position: "absolute" as const,
    fontSize: 6,
    fontFamily: "Courier",
    color: INK_SOFT,
  };
  /**
   * Un titre d'axe couché le long de sa gouttière. La boîte fait la hauteur
   * du cadre puis pivote sur son centre, seule façon d'écrire à la verticale
   * sans mesurer le texte.
   */
  const titreVertical = (centreX: number) => ({
    position: "absolute" as const,
    left: centreX - cadreH / 2,
    top: REPERES + cadreH / 2 - 4,
    width: cadreH,
    textAlign: "center" as const,
    fontSize: 6,
    fontFamily: "Helvetica",
    color: INK_SOFT,
  });

  return (
    <View style={{ width: largeurPt, height: hauteurPt, position: "relative" }}>
      <Text style={{ ...titreVertical(6), transform: "rotate(-90deg)" }}>
        Allure (/km)
      </Text>
      <Text
        style={{
          ...titreVertical(largeurPt - 6),
          transform: "rotate(90deg)",
        }}
      >
        Altitude (m)
      </Text>

      {figure.graduations.map((g) => (
        <Text
          key={`allure-${g.y}`}
          style={{
            ...legende,
            left: 12,
            top: REPERES + versY(g.y) - 3,
            width: GOUTTIERE_G - 16,
            textAlign: "right",
          }}
        >
          {g.allure}
        </Text>
      ))}

      {figure.graduations.map((g) => (
        <Text
          key={`ele-${g.y}`}
          style={{
            ...legende,
            left: largeurPt - GOUTTIERE_D + 4,
            top: REPERES + versY(g.y) - 3,
          }}
        >
          {g.altitude}
        </Text>
      ))}

      {figure.distances.map((g) => (
        <Text
          key={`km-${g.texte}`}
          style={{
            ...legende,
            left: GOUTTIERE_G + versX(g.x) - 9,
            top: hauteurPt - DISTANCES - TITRE_BAS + 2,
            width: 18,
            textAlign: "center",
          }}
        >
          {g.texte}
        </Text>
      ))}

      <Text
        style={{
          position: "absolute",
          left: GOUTTIERE_G,
          top: hauteurPt - TITRE_BAS + 1,
          width: cadreL,
          textAlign: "center",
          fontSize: 6,
          color: INK_SOFT,
        }}
      >
        Distance (km)
      </Text>

      {figure.bornes.map((borne) => (
        <Text
          key={`repere-${borne.repere}`}
          style={{
            position: "absolute",
            fontSize: 6,
            fontFamily: "Helvetica-Bold",
            color: INK,
            left: GOUTTIERE_G + versX(borne.x) - 9,
            top: 0,
            width: 18,
            textAlign: "center",
          }}
        >
          {borne.repere}
        </Text>
      ))}

      <Svg
        viewBox={`0 0 ${figure.cadre.largeur} ${figure.cadre.hauteur}`}
        style={{
          position: "absolute",
          left: GOUTTIERE_G,
          top: REPERES,
          width: cadreL,
          height: cadreH,
        }}
      >
        {/* La grille passe sous tout le reste. Une seule suite de lignes,
            lue en altitude d'un côté et en allure de l'autre. */}
        {figure.graduations.map((g) => (
          <Line
            key={`grille-${g.y}`}
            x1={0}
            y1={g.y}
            x2={figure.cadre.largeur}
            y2={g.y}
            stroke={GRILLE}
            strokeWidth={1}
          />
        ))}

        {figure.bornes.map((borne) => (
          <Line
            key={borne.repere}
            x1={borne.x}
            y1={0}
            x2={borne.x}
            y2={figure.cadre.hauteur}
            stroke={LINE}
            strokeWidth={1.5}
          />
        ))}

        {/* L'aplat porte la masse du relief, la crête porte sa ligne. */}
        <Path d={figure.relief.aplat} fill={RELIEF} />
        <Path
          d={figure.relief.crete}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Un trait par palier et par contremarche, chacun avec sa couleur
            de rampe : voir `escalier` dans `profile.ts`. */}
        {figure.allure?.map((segment) => (
          <Line
            key={`${segment.x1}-${segment.y1}-${segment.x2}-${segment.y2}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.couleur}
            strokeWidth={2.5}
            // Bout franc, pas arrondi : paliers et contremarches partagent
            // leurs extrémités, et deux bouts arrondis superposés
            // épaississent le joint au lieu de le fermer.
            strokeLinecap="butt"
          />
        ))}

        <Line
          x1={0}
          y1={figure.cadre.hauteur}
          x2={figure.cadre.largeur}
          y2={figure.cadre.hauteur}
          stroke={INK}
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}
