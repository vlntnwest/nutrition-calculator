/**
 * Tire les variables partagées depuis Vercel dans `.env.local`, puis en retire
 * la base de données.
 *
 *   npm run env:pull
 *
 * L'intégration Neon–Vercel renseigne `DATABASE_URL` dans *tous* les
 * environnements du projet, Development compris. Or `.env.local` prime sur le
 * `.env` du dépôt : un `pull` nu suffit donc à faire pointer la machine sur une
 * branche Neon. Le garde-fou de `src/db/env.ts` rattrape `dev`, `test` et
 * `drizzle-kit`, mais pas un `next build` local, qui tourne en
 * `NODE_ENV=production` et où le garde-fou se tait.
 *
 * Les supprimer côté Vercel ne tiendrait pas : l'intégration les réécrit. On
 * les retire donc à l'arrivée, à chaque fois, plutôt que de compter sur une
 * discipline. La base d'un poste de travail vient de `.env`, jamais d'ailleurs.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const FILE = ".env.local";
const DROPPED =
  /^(DATABASE_URL|DATABASE_URL_UNPOOLED|POSTGRES_[A-Z_]+|PG[A-Z]+)=/;

execFileSync(
  "npx",
  [
    "--yes",
    "vercel",
    "env",
    "pull",
    FILE,
    "--environment=development",
    "--yes",
  ],
  { stdio: "inherit" },
);

const lines = readFileSync(FILE, "utf8").split("\n");
const kept = lines.filter((line) => !DROPPED.test(line));
const dropped = lines.length - kept.length;

if (dropped > 0) {
  writeFileSync(FILE, kept.join("\n"));
  console.log(
    `\n${dropped} variable(s) de base de données retirée(s) de ${FILE} : ` +
      "un poste de travail lit .env, jamais Vercel.",
  );
}
