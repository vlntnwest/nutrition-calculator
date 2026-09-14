/**
 * Ce avec quoi le graphique dessine : couleurs, police et grain du tracé.
 */

/**
 * Les couleurs du carnet, en dur : un `<canvas>` dessine avec l'API 2D, qui
 * ne résout pas les variables CSS — seule la SVG (la carte, plus haut) vit
 * dans le DOM et en profite. Ces valeurs miroitent `globals.css` ; les
 * changer là-bas sans les changer ici les désynchronise.
 */
export const INK = "#131313";
export const INK_SOFT = "#5c5c5c";
export const LINE = "#1313131f";
export const LINE_STRONG = "#13131333";
export const PAPER = "#ffffff";

/** L'aplat sous la courbe : de l'encre à cinq pour cent, la masse du relief. */
export const FILL = "#1313130d";

/**
 * `context.font` sur un `<canvas>` ne résout pas non plus les variables CSS
 * (`var(--font-geist-mono)` n'y vaudrait rien) : une pile mono littérale,
 * pas la police Geist chargée par `next/font` pour le reste de la page.
 */
export const MONO_STACK = "ui-monospace, Menlo, Consolas, monospace";

/**
 * Le nombre de points réellement tracés.
 *
 * Chaque segment porte sa propre couleur de pente et son propre
 * remplissage : en dessous d'un pixel de large, ils se moirent et le relief
 * se lit comme un code-barres. Quatre cents points suffisent à dessiner un
 * profil à n'importe quelle largeur d'écran, et le survol continue de
 * désigner le point d'origine, celui que la carte connaît.
 */
export const POINTS_TRACES = 400;

/**
 * En dessous de cette largeur de cadre, l'allure cesse de se superposer au
 * relief : les marches se resserrent au point de couvrir la silhouette, et
 * l'écran étroit n'a pas la place de les faire cohabiter. Elles prennent
 * alors un bandeau à part, en haut, et le relief garde le reste.
 */
export const LARGEUR_SUPERPOSITION = 640;

/** Le nom de la pile qui range l'allure au-dessus du relief. */
export const PILE = "profil";
