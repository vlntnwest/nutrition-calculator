import { loadEnvConfig } from "@next/env";

// Pour les processus hors Next — drizzle-kit, vitest, tsx. Sous `next dev` et
// `next build`, Next a déjà chargé l'environnement et `@next/env` mémoïse : cet
// appel est alors sans effet, ce qui est la raison pour laquelle le socle vit
// dans `.env`, seul fichier que Next ouvre dans les trois modes.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function isLocalHost(url: string): boolean {
  const { hostname } = new URL(url);
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

/**
 * `sslmode=verify-full`, là où l'URL annonce un mode que pg lit déjà ainsi.
 *
 * Neon donne ses URL en `sslmode=require`, et l'intégration Vercel les pose
 * telles quelles, branches de preview comprises. pg v8 traite `prefer`,
 * `require` et `verify-ca` comme `verify-full`, mais prévient à chaque
 * démarrage qu'en v9 ils prendront le sens de libpq, où `require` chiffre sans
 * vérifier le certificat. Écrire le mode ici garde la vérification
 * d'aujourd'hui à travers la montée de version, sans dépendre des variables
 * du projet Vercel.
 *
 * Une URL qui demande `uselibpqcompat=true` a choisi le sens de libpq : on la
 * laisse, `verify-full` y exigerait un certificat racine qu'elle ne donne pas.
 * Une réécriture de texte plutôt qu'un passage par `URL`, dont la
 * sérialisation pourrait réencoder un mot de passe.
 */
export function withVerifiedSsl(url: string): string {
  if (/[?&]uselibpqcompat=true(?=&|$)/.test(url)) return url;

  return url.replace(
    /([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/,
    "$1verify-full",
  );
}

// Une URL Neon dans un fichier d'environnement local a déjà fait écrire `npm
// run dev`, `db:migrate` et surtout `npm test` dans la base de production.
// Hors production, la base doit donc être sur cette machine.
function readUrl(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} manquante — voir .env.example et npm run env:pull.`,
    );
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_REMOTE_DB !== "1" &&
    !isLocalHost(value)
  ) {
    throw new Error(
      `${name} vise une base distante hors production. Démarrer le Postgres local ` +
        "avec npm run db:up, ou passer ALLOW_REMOTE_DB=1 pour une inspection ponctuelle.",
    );
  }

  return withVerifiedSsl(value);
}

/** La connexion de l'application : poolée sur Neon. */
export const databaseUrl = readUrl("DATABASE_URL", process.env.DATABASE_URL);

/**
 * La connexion des migrations. Le pooler de Neon est en mode transaction et le
 * DDL s'en passe mal ; l'intégration Vercel expose la connexion directe à côté.
 */
export const migrationUrl = process.env.DATABASE_URL_UNPOOLED
  ? readUrl("DATABASE_URL_UNPOOLED", process.env.DATABASE_URL_UNPOOLED)
  : databaseUrl;
