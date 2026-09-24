import type { NextConfig } from "next";

/**
 * Les en-têtes que le navigateur applique sans qu'on ait à y penser.
 *
 * Pas de politique de contenu (CSP) ici : elle demande d'énumérer les
 * origines — tuiles OpenStreetMap, photos du store Blob — et de traiter les
 * styles en ligne de Next, et elle se vérifie dans un navigateur, pas dans
 * un test. C'est un geste à part.
 *
 * `no-referrer` plutôt que le défaut du navigateur : l'identifiant d'accès
 * vit dans l'URL, et un lien d'achat sortant le porterait à la boutique. Une
 * exception, sur l'image seule : les tuiles de `RouteMap` doivent s'annoncer,
 * sans quoi OSM répond un carré « Access denied ».
 *
 * Pas de HSTS non plus : posé ici, il partirait aussi des previews, et
 * `includeSubDomains` engagerait pour deux ans des sous-domaines qui
 * n'existent pas encore. C'est au domaine de production de le porter.
 */
const SECURITE = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.20"],
  headers: () => Promise.resolve([{ source: "/:path*", headers: SECURITE }]),
};

export default nextConfig;
