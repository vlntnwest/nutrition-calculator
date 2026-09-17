import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ProfileFigure } from "./profile";
import { SheetMap } from "./SheetMap";
import { SheetProfile } from "./SheetProfile";
import type { Sheet as Feuille } from "./sheet";
import type { Carte } from "./sheetMapData";
import { HAUTEUR_CARTE, HAUTEUR_PROFIL, LARGEUR_UTILE, s } from "./styles";
import { CoursesTable, TableauUnique } from "./Tables";

/**
 * La feuille à emporter, en A4. Voir `docs/pdf-du-roadbook.md`.
 *
 * Le fichier ne s'appelle pas `Sheet.tsx` : `sheet.ts`, qui range les lignes,
 * existe déjà à côté, et deux noms qui ne diffèrent que par la casse ne
 * cohabitent pas sur un système de fichiers qui l'ignore.
 *
 * `carte` et `profil` sont nuls quand la trace n'a pas de géométrie
 * exploitable, ou que pas une tuile n'a répondu. La feuille se rend alors
 * sans eux plutôt que de refuser de se rendre : le roadbook en est la
 * matière, la figure en est le repérage.
 */
export function SheetDocument({
  feuille,
  carte,
  profil,
}: {
  feuille: Feuille;
  carte: Carte | null;
  profil: ProfileFigure | null;
}) {
  const { entete, cibles } = feuille;
  const identite = [
    entete.date,
    entete.depart === "" ? "" : `départ ${entete.depart}`,
    `${entete.chrono} visées`,
    entete.allure === "" ? "" : `${entete.allure} /km`,
  ].filter(Boolean);

  return (
    <Document
      title={`Roadbook ${entete.nom}`}
      author="nutrition-calculator"
      language="fr"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.titre}>{entete.nom}</Text>
        <Text style={s.releve}>
          {entete.distance} km · D+ {entete.denivele} m
        </Text>
        <Text style={[s.releve, { marginTop: 3 }]}>{identite.join(" · ")}</Text>

        <View
          style={[
            s.rangee,
            s.filetFort,
            { marginTop: 10, paddingBottom: 7, gap: 26 },
          ]}
        >
          {[
            { cle: "glucides", valeur: cibles.carbs },
            { cle: "boisson", valeur: cibles.boisson },
            { cle: "sodium", valeur: cibles.sodium },
            // Le poids du sac n'est pas une cible, mais c'est le nombre qu'on
            // veut voir avant de partir : il n'a pas à attendre la dernière
            // page. Section 4 du document.
            { cle: "porté au départ", valeur: feuille.totaux.poids },
          ].map((cible) => (
            <View key={cible.cle}>
              <Text style={[s.nombre, { fontSize: 11 }]}>{cible.valeur}</Text>
              <Text style={s.discret}>{cible.cle}</Text>
            </View>
          ))}
        </View>

        {carte !== null && (
          <View style={{ marginTop: 12 }}>
            <SheetMap
              cadrage={carte.cadrage}
              tuiles={carte.tuiles}
              points={carte.points}
              bornes={carte.bornes}
              largeurPt={LARGEUR_UTILE}
              hauteurPt={HAUTEUR_CARTE}
            />
            <Text style={[s.discret, { fontSize: 6.5, marginTop: 2 }]}>
              Fond de carte © les contributeurs d'OpenStreetMap.
            </Text>
          </View>
        )}

        {profil !== null && (
          <View style={{ marginTop: 10 }}>
            <SheetProfile
              figure={profil}
              largeurPt={LARGEUR_UTILE}
              hauteurPt={HAUTEUR_PROFIL}
            />
          </View>
        )}

        {feuille.avertissements.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {feuille.avertissements.map((texte) => (
              <Text key={texte} style={s.avertissement}>
                {texte}
              </Text>
            ))}
          </View>
        )}

        <TableauUnique secteurs={feuille.secteurs} />
        <CoursesTable courses={feuille.courses} totaux={feuille.totaux} />

        <View style={s.pied} fixed>
          <Text>
            Un plan se teste à l'entraînement avant de s'appliquer en course.
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
