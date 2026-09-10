/**
 * L'affiche d'une course officielle, dans Vercel Blob sous
 * `plans-images/{slug}.webp` — une convention de nommage, jamais une colonne
 * en base : elle se déduit, le `slug` étant déjà la clé stable de la course.
 *
 * Le pendant de `productImageUrl`, qui déduit de la même façon l'image d'un
 * produit de son `codeSeed`.
 */
export function planImageUrl(slug: string): string {
  return `${process.env.NEXT_PUBLIC_BLOB_BASE_URL}/plans-images/${slug}.webp`;
}
