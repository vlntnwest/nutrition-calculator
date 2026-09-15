import { StyleSheet } from "@react-pdf/renderer";

/**
 * Le traitement de la feuille, pensé pour une imprimante de bureau en noir et
 * blanc. Voir `docs/pdf-du-roadbook.md`, section 5.
 *
 * Les valeurs ne miroitent pas `globals.css` : l'écran pose des filets à
 * douze pour cent d'opacité, qui à l'impression ne laissent rien. Un filet de
 * papier est un gris franc, et aucun texte ne descend sous `INK_SOFT`.
 */
export const INK = "#131313";
export const INK_SOFT = "#5c5c5c";
export const LINE = "#c4c4c4";

/**
 * L'aplat du relief. Un gris franc, pas l'encre à cinq pour cent de l'écran :
 * une trame aussi claire ne laisse rien sur une imprimante de bureau.
 */
export const RELIEF = "#dcdcdc";

/**
 * Les lignes de repère du profil, qui prolongent les graduations à travers le
 * cadre. Plus claires que `LINE`, qui marque les bornes : une grille se
 * regarde à travers, une borne se regarde.
 */
export const GRILLE = "#e4e4e4";

/** Les marges d'une A4 à quinze millimètres, en points PDF. */
export const MARGE = 42.5;

/** La largeur d'une A4 en points PDF, et ce qu'il en reste entre les marges. */
export const LARGEUR_A4 = 595.28;
export const LARGEUR_UTILE = LARGEUR_A4 - MARGE * 2;

export const HAUTEUR_CARTE = 200;
export const HAUTEUR_PROFIL = 168;

/**
 * Le fond de carte se demande à deux fois la taille qu'il occupe sur le
 * papier, puis se réduit. Une tuile agrandie est floue à l'impression, une
 * tuile réduite ne l'est pas.
 */
export const FINESSE = 2;

export const s = StyleSheet.create({
  page: {
    paddingTop: MARGE,
    paddingBottom: MARGE + 14,
    paddingHorizontal: MARGE,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
  },

  titre: { fontFamily: "Helvetica-Bold", fontSize: 19 },
  releve: { fontFamily: "Courier", fontSize: 9, color: INK_SOFT },
  section: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 5,
  },

  rangee: { flexDirection: "row", alignItems: "baseline" },
  filet: { borderBottomWidth: 0.5, borderBottomColor: LINE },
  filetFort: { borderBottomWidth: 1, borderBottomColor: INK },

  enteteCellule: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: INK_SOFT,
    paddingBottom: 3,
  },
  cellule: { paddingVertical: 3.5 },
  nombre: { fontFamily: "Courier", fontSize: 8.5 },
  discret: { color: INK_SOFT, fontSize: 8 },

  avertissement: {
    borderWidth: 0.5,
    borderColor: INK,
    padding: 6,
    marginBottom: 4,
    fontSize: 8,
    lineHeight: 1.4,
  },

  pied: {
    position: "absolute",
    bottom: MARGE - 14,
    left: MARGE,
    right: MARGE,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: INK_SOFT,
  },
});
