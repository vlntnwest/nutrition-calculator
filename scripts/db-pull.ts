/**
 * Recopie une base déployée dans le Postgres local.
 *
 *   npm run db:pull
 *
 * C'est la dernière étape de la boucle : on développe en local, on éprouve sur
 * staging, on promeut en production, puis on retire les données réelles pour
 * repartir du terrain plutôt que d'un jeu d'essai vieillissant.
 *
 * La source par défaut est staging, jamais la production : `staging` est une
 * copie de `production` après un passage du workflow « Réinitialiser staging »,
 * donc on obtient les mêmes données sans que la production voie personne.
 * Copier la production est un autre geste, et il se demande :
 *
 *   npm run db:pull -- production
 *
 * Les deux URL vivent dans `.env.local`, une fois par machine. Aucune ne
 * s'appelle `DATABASE_URL` : sous ce nom-là, le garde-fou de `src/db/env.ts`
 * refuserait de démarrer, et c'est très bien ainsi — une base déployée se lit
 * pour être copiée, jamais pour faire tourner l'application. Prendre la
 * connexion **directe**, pas la poolée : `pg_dump` a besoin d'un snapshot
 * cohérent sur une session, et le pooler de Neon est en mode transaction.
 *
 * `pg_dump` s'exécute dans le conteneur et non sur la machine : sa version doit
 * être au moins celle du serveur, et un `pg_dump` installé par Homebrew a
 * souvent une majeure de retard, auquel cas il refuse de lire.
 *
 * L'URL passe par l'entrée standard, jamais par les arguments ni par
 * l'environnement du conteneur : sinon elle s'afficherait dans un `ps`.
 */

import { execFileSync } from "node:child_process";
import { databaseUrl } from "@/db/env";

const SOURCES = {
  staging: "STAGING_DATABASE_URL",
  production: "PROD_DATABASE_URL",
} as const;

type Source = keyof typeof SOURCES;

const demande = process.argv[2] ?? "staging";

if (!(demande in SOURCES)) {
  console.error(
    `Source « ${demande} » inconnue. Attendu : staging ou production.`,
  );
  process.exit(1);
}

const variable = SOURCES[demande as Source];
const source = process.env[variable];

if (!source) {
  console.error(
    `${variable} manquante. Renseigner dans .env.local la connexion directe\n` +
      "de la branche Neon à recopier — voir .env.example.",
  );
  process.exit(1);
}

// Le pooler de Neon est en mode transaction : pg_dump y perd le snapshot
// cohérent dont il a besoin. L'erreur qu'il rend alors ne dit pas pourquoi.
if (new URL(source).hostname.includes("-pooler")) {
  console.error(
    `${variable} vise le pooler. Prendre la connexion directe — le même hôte,\n` +
      "sans le suffixe -pooler.",
  );
  process.exit(1);
}

// `databaseUrl` a déjà traversé le garde-fou : l'atteindre ici suffit à savoir
// que la cible est locale. Reste à en tirer le nom de la base.
const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));

const script = `
set -e
IFS= read -r SOURCE
pg_dump --no-owner --no-privileges --clean --if-exists "$SOURCE" |
  psql -v ON_ERROR_STOP=1 -U postgres -d "${database}" >/dev/null
`;

console.log(`Recopie de ${demande} vers « ${database} »…`);

execFileSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.dev.yml",
    "exec",
    "-T",
    "postgres",
    "sh",
    "-c",
    script,
  ],
  { input: `${source}\n`, stdio: ["pipe", "inherit", "inherit"] },
);

const counts = execFileSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.dev.yml",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-d",
    database,
    "-tAc",
    "select 'plans=' || count(*) from plans union all select 'produits=' || count(*) from products union all select 'migrations=' || count(*) from drizzle.__drizzle_migrations",
  ],
  { encoding: "utf8" },
);

console.log(counts.trim().split("\n").join(" · "));
console.log(
  "Relancer npm run db:migrate si la branche en cours porte une migration.",
);
