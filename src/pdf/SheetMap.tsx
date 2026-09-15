import { Circle, Image, Polyline, Svg, Text, View } from "@react-pdf/renderer";
import { type Cadrage, type Point, projeter, TAILLE_TUILE } from "./staticMap";
import { INK, LINE } from "./styles";
import type { TuileChargee } from "./tiles";

/**
 * Le fond de carte et la trace. Voir `docs/pdf-du-roadbook.md`, sections 2.4
 * et 3.1.
 *
 * Les tuiles sont des images posées à leur décalage, la trace une `<Svg>`
 * par-dessus : aucun canevas n'intervient, et le tracé reste vectoriel.
 *
 * Le cadrage est calculé au double de la taille sur le papier pour que les
 * tuiles ne soient jamais agrandies. C'est ici qu'on réduit : `echelle` pour
 * les images, et la `viewBox` s'en charge pour la partie vectorielle.
 */
export function SheetMap({
  cadrage,
  tuiles,
  points,
  bornes,
  largeurPt,
  hauteurPt,
}: {
  cadrage: Cadrage;
  tuiles: TuileChargee[];
  points: Point[];
  /** Les points à marquer, et ce qu'ils portent : `D`, `A`, ou un rang. */
  bornes: { point: Point; label: string }[];
  largeurPt: number;
  hauteurPt: number;
}) {
  const echelle = cadrage.cadre.largeurPx / largeurPt;
  const trace = points
    .map((point) => {
      const { x, y } = projeter(cadrage, point);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <View
      style={{
        width: largeurPt,
        height: hauteurPt,
        position: "relative",
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: LINE,
      }}
    >
      {tuiles.map((tuile) => (
        <Image
          key={`${tuile.z}/${tuile.x}/${tuile.y}`}
          src={{ data: tuile.data, format: "png" }}
          style={{
            position: "absolute",
            left: tuile.dx / echelle,
            top: tuile.dy / echelle,
            width: TAILLE_TUILE / echelle,
            height: TAILLE_TUILE / echelle,
          }}
        />
      ))}

      <Svg
        viewBox={`0 0 ${cadrage.cadre.largeurPx} ${cadrage.cadre.hauteurPx}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: largeurPt,
          height: hauteurPt,
        }}
      >
        {/* Deux passes : un liseré blanc large, puis l'encre par-dessus. Les
            tuiles gardent leurs couleurs, et la trace ressort quand même une
            fois la feuille passée en gris. */}
        <Polyline
          points={trace}
          fill="none"
          stroke="#ffffff"
          strokeWidth={10}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Polyline
          points={trace}
          fill="none"
          stroke={INK}
          strokeWidth={4.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {bornes.map(({ point, label }) => {
          const { x, y } = projeter(cadrage, point);

          return (
            <Circle
              key={label}
              cx={x}
              cy={y}
              r={13}
              fill="#ffffff"
              stroke={INK}
              strokeWidth={3.5}
            />
          );
        })}
        {bornes.map(({ point, label }) => {
          const { x, y } = projeter(cadrage, point);

          return (
            <Text
              key={label}
              x={x}
              y={y + 6}
              textAnchor="middle"
              fill={INK}
              style={{ fontSize: 17, fontFamily: "Helvetica-Bold" }}
            >
              {label}
            </Text>
          );
        })}
      </Svg>
    </View>
  );
}
