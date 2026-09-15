import { Text, View } from "@react-pdf/renderer";
import type { Course, Passage, Secteur, Sheet } from "./sheet";
import { s } from "./styles";

/**
 * Les tableaux de la feuille, forme « deux tableaux » : les temps de passage
 * d'un côté, le ravitaillement de l'autre. Voir `docs/pdf-du-roadbook.md`,
 * section 6.1.
 *
 * Les largeurs sont en pour-cent plutôt qu'en points : la feuille reste juste
 * si les marges bougent.
 */

const PASSAGE = {
  repere: "5%",
  borne: "21%",
  km: "9%",
  denivele: "17%",
  duree: "12%",
  passage: "14%",
  ecoule: "12%",
  arret: "10%",
} as const;

export function PassagesTable({ passages }: { passages: Passage[] }) {
  return (
    <View>
      <Text style={s.section}>Temps de passage</Text>

      <View style={[s.rangee, s.filetFort]}>
        <Text style={[s.enteteCellule, { width: PASSAGE.repere }]} />
        <Text style={[s.enteteCellule, { width: PASSAGE.borne }]}>Borne</Text>
        <Text
          style={[s.enteteCellule, { width: PASSAGE.km, textAlign: "right" }]}
        >
          km
        </Text>
        <Text
          style={[
            s.enteteCellule,
            { width: PASSAGE.denivele, textAlign: "right" },
          ]}
        >
          D+ / D-
        </Text>
        <Text
          style={[
            s.enteteCellule,
            { width: PASSAGE.duree, textAlign: "right" },
          ]}
        >
          Secteur
        </Text>
        <Text
          style={[
            s.enteteCellule,
            { width: PASSAGE.passage, textAlign: "right" },
          ]}
        >
          Passage
        </Text>
        <Text
          style={[
            s.enteteCellule,
            { width: PASSAGE.ecoule, textAlign: "right" },
          ]}
        >
          Écoulé
        </Text>
        <Text
          style={[
            s.enteteCellule,
            { width: PASSAGE.arret, textAlign: "right" },
          ]}
        >
          Arrêt
        </Text>
      </View>

      {passages.map((p) => (
        <View
          key={`${p.borne}-${p.km}`}
          style={[s.rangee, s.filet]}
          wrap={false}
        >
          {/* Le repère que la carte porte sur cette borne : c'est par lui
              qu'un numéro lu sur la carte retrouve sa ligne. */}
          <Text style={[s.cellule, s.nombre, { width: PASSAGE.repere }]}>
            {p.repere}
          </Text>
          <Text style={[s.cellule, { width: PASSAGE.borne }]}>{p.borne}</Text>
          <Text
            style={[
              s.cellule,
              s.nombre,
              { width: PASSAGE.km, textAlign: "right" },
            ]}
          >
            {p.km}
          </Text>
          <Text
            style={[
              s.cellule,
              s.nombre,
              { width: PASSAGE.denivele, textAlign: "right" },
            ]}
          >
            {p.denivele}
          </Text>
          <Text
            style={[
              s.cellule,
              s.nombre,
              { width: PASSAGE.duree, textAlign: "right" },
            ]}
          >
            {p.duree}
          </Text>
          <Text
            style={[
              s.cellule,
              s.nombre,
              { width: PASSAGE.passage, textAlign: "right" },
            ]}
          >
            {p.passage}
          </Text>
          <Text
            style={[
              s.cellule,
              s.nombre,
              { width: PASSAGE.ecoule, textAlign: "right" },
            ]}
          >
            {p.ecoule}
          </Text>
          <Text
            style={[
              s.cellule,
              s.nombre,
              { width: PASSAGE.arret, textAlign: "right" },
            ]}
          >
            {p.arret}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Un secteur ne se coupe pas entre deux pages (`wrap={false}`) : ses rations
 * ne se lisent que sous le titre qui dit où l'on est.
 */
function SecteurBloc({ secteur }: { secteur: Secteur }) {
  return (
    <View style={{ marginBottom: 9 }} wrap={false}>
      {/* Le titre et son relevé tiennent deux lignes plutôt qu'une : sur un
          ultra, les bornes portent des noms longs, et tout aligner sur une
          seule ligne collait les nombres les uns aux autres. */}
      <View
        style={[
          s.filetFort,
          { flexDirection: "row", alignItems: "flex-end", paddingBottom: 3 },
        ]}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>
            {secteur.titre}
          </Text>
          <Text style={[s.nombre, s.discret, { marginTop: 1.5 }]}>
            {secteur.km} km · {secteur.duree}
          </Text>
        </View>
        <Text style={s.nombre}>
          {secteur.apport} sur {secteur.besoin}
          {secteur.ecart === "" ? "" : ` (${secteur.ecart})`}
        </Text>
      </View>

      {secteur.rations.length === 0 && (
        <Text style={[s.cellule, s.discret]}>Rien de posé sur ce secteur.</Text>
      )}

      {secteur.rations.map((r) => (
        <View key={r.produit} style={[s.rangee, s.filet]}>
          <Text style={[s.cellule, s.nombre, { width: "8%" }]}>
            {r.quantite} ×
          </Text>
          <View style={[s.cellule, { flex: 1, paddingRight: 8 }]}>
            <Text>{r.produit}</Text>
            <Text style={s.discret}>
              {[r.marque, r.format].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text
            style={[s.cellule, s.nombre, { width: "14%", textAlign: "right" }]}
          >
            {r.carbs}
          </Text>
          <Text
            style={[s.cellule, s.nombre, { width: "16%", textAlign: "right" }]}
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
  );
}

export function RavitaillementTable({ secteurs }: { secteurs: Secteur[] }) {
  return (
    <View>
      <Text style={s.section}>Ravitaillement</Text>
      <View style={[s.rangee, { marginBottom: 4 }]}>
        <Text style={[s.discret, { flex: 1 }]}>
          Sous chaque secteur, ce qu'il apporte sur ce qu'il vise.
        </Text>
        <Text style={[s.enteteCellule, { width: "14%", textAlign: "right" }]}>
          Glucides
        </Text>
        <Text style={[s.enteteCellule, { width: "16%", textAlign: "right" }]}>
          Sodium
        </Text>
      </View>

      {secteurs.map((secteur) => (
        <SecteurBloc key={secteur.titre} secteur={secteur} />
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
