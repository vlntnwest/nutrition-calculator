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

  return value;
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
