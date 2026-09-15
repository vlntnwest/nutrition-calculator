import { Text, View } from "@react-pdf/renderer";
import type { Course, Secteur, Sheet } from "./sheet";
import { s } from "./styles";

/**
 * Les tableaux de la feuille. Voir `docs/pdf-du-roadbook.md`, section 6.
 *
 * Les largeurs sont en pour-cent plutôt qu'en points : la feuille reste juste
 * si les marges bougent.
 */

/**
 * Les largeurs de la forme à un tableau, en pour-cent et en nombres : la
 * ligne d'un produit laisse vides toutes les colonnes de temps, et cette
 * largeur-là se déduit plutôt que de se recopier — recopiée, elle devenait
 * fausse au premier ajustement.
 */
const U = {
  repere: 4,
  km: 11,
  duree: 9,
  passage: 10,
  arret: 7,
  glucides: 11,
  sodium: 13,
};
const TEMPS = U.km + U.duree + U.passage + U.arret;
const APPORT = U.glucides + U.sodium;
const pc = (part: number) => `${part}%` as const;

/**
 * Forme « un tableau » : les temps de passage et les rations sur une seule
 * suite de lignes. Voir `docs/pdf-du-roadbook.md`, section 6.2.
 *
 * Elle tient le fil de la course en une lecture, là où la forme à deux
 * tableaux demande l'aller-retour entre deux pages. Elle charge en revanche
 * la ligne, et sur un ultra à quinze ravitos elle fera long.
 */
export function TableauUnique({ secteurs }: { secteurs: Secteur[] }) {
  const droite = { textAlign: "right" as const };

  return (
    <View>
      <Text style={s.section}>La course, secteur par secteur</Text>

      <View style={[s.rangee, s.filetFort]}>
        <Text style={[s.enteteCellule, { width: pc(U.repere) }]} />
        <Text style={[s.enteteCellule, { flex: 1 }]}>Borne et rations</Text>
        <Text style={[s.enteteCellule, droite, { width: pc(U.km) }]}>km</Text>
        <Text style={[s.enteteCellule, droite, { width: pc(U.duree) }]}>
          Secteur
        </Text>
        <Text style={[s.enteteCellule, droite, { width: pc(U.passage) }]}>
          Passage
        </Text>
        <Text style={[s.enteteCellule, droite, { width: pc(U.arret) }]}>
          Arrêt
        </Text>
        <Text style={[s.enteteCellule, droite, { width: pc(APPORT) }]}>
          Glucides · sodium
        </Text>
      </View>

      {secteurs.map((secteur) => (
        <View key={secteur.titre} style={{ marginTop: 6 }} wrap={false}>
          {/* La ligne du secteur porte la borne qui le clôt : c'est d'elle
              que parlent l'heure de passage et l'arrêt. */}
          <View style={[s.rangee, s.filet]}>
            <Text style={[s.cellule, s.nombre, { width: pc(U.repere) }]}>
              {secteur.repere}
            </Text>
            <Text
              style={[
                s.cellule,
                { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
              ]}
            >
              {secteur.arrivee}
            </Text>
            <Text style={[s.cellule, s.nombre, droite, { width: pc(U.km) }]}>
              {secteur.km}
            </Text>
            <Text style={[s.cellule, s.nombre, droite, { width: pc(U.duree) }]}>
              {secteur.duree}
            </Text>
            <Text
              style={[s.cellule, s.nombre, droite, { width: pc(U.passage) }]}
            >
              {secteur.passage}
            </Text>
            <Text style={[s.cellule, s.nombre, droite, { width: pc(U.arret) }]}>
              {secteur.arret}
            </Text>
            <Text style={[s.cellule, s.nombre, droite, { width: pc(APPORT) }]}>
              {secteur.apport} sur {secteur.besoin}
              {secteur.ecart === "" ? "" : ` (${secteur.ecart})`}
            </Text>
          </View>

          {secteur.rations.length === 0 && (
            <Text style={[s.cellule, s.discret, { paddingLeft: 20 }]}>
              Rien de posé sur ce secteur.
            </Text>
          )}

          {secteur.rations.map((r) => (
            <View key={r.produit} style={[s.rangee, s.filet]}>
              <Text style={[s.cellule, { width: pc(U.repere) }]} />
              <View style={[s.cellule, { flex: 1, flexDirection: "row" }]}>
                <Text style={[s.nombre, { width: 26 }]}>{r.quantite} ×</Text>
                <View style={{ flex: 1 }}>
                  <Text>{r.produit}</Text>
                  <Text style={s.discret}>
                    {[r.marque, r.format].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
              {/* Les colonnes de temps ne disent rien d'une ration. */}
              <Text style={[s.cellule, { width: pc(TEMPS) }]} />
              <Text
                style={[s.cellule, s.nombre, droite, { width: pc(U.glucides) }]}
              >
                {r.carbs}
              </Text>
              <Text
                style={[s.cellule, s.nombre, droite, { width: pc(U.sodium) }]}
              >
                {r.sodium}
              </Text>
            </View>
          ))}

          {secteur.avertissements.map((texte) => (
            <Text key={texte} style={[s.avertissement, { marginTop: 4 }]}>
              {texte}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function CoursesTable({
  courses,
  totaux,
}: {
  courses: Course[];
  totaux: Sheet["totaux"];
}) {
  return (
    <View>
      <Text style={s.section}>La liste de courses</Text>

      <View style={[s.rangee, s.filetFort]}>
        <Text style={[s.enteteCellule, { width: "10%" }]}>Quantité</Text>
        <Text style={[s.enteteCellule, { flex: 1 }]}>Produit</Text>
        <Text style={[s.enteteCellule, { width: "30%" }]}>Marque</Text>
      </View>

      {courses.length === 0 && (
        <Text style={[s.cellule, s.discret]}>Rien dans le sac.</Text>
      )}

      {courses.map((c) => (
        <View key={c.produit} style={[s.rangee, s.filet]} wrap={false}>
          <Text style={[s.cellule, s.nombre, { width: "10%" }]}>
            {c.quantite} ×
          </Text>
          <Text style={[s.cellule, { flex: 1 }]}>{c.produit}</Text>
          <Text style={[s.cellule, s.discret, { width: "30%" }]}>
            {c.marque}
          </Text>
        </View>
      ))}

      <View
        style={[s.rangee, { marginTop: 9, justifyContent: "space-between" }]}
      >
        {[
          {
            cle: "glucides",
            valeur:
              totaux.ecart === ""
                ? totaux.carbs
                : `${totaux.carbs} (${totaux.ecart})`,
          },
          { cle: "énergie", valeur: totaux.energie },
          { cle: "sodium", valeur: totaux.sodium },
          { cle: "boisson", valeur: totaux.boisson },
          { cle: "porté au départ", valeur: totaux.poids },
        ].map((total) => (
          <View key={total.cle}>
            <Text style={[s.nombre, { fontSize: 10 }]}>{total.valeur}</Text>
            <Text style={s.discret}>{total.cle}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
