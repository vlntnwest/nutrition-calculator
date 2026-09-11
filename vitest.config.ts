import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Le `@/*` de tsconfig n'est connu que du compilateur : Vitest a besoin qu'on
// le lui redise, sans quoi les tests ne résolvent pas ce que `tsc` accepte.
export default defineConfig({
  test: {
    environment: "node",
    // `shortDate` rend la date du fuseau de la machine : sans réglage, un
    // instant UTC se lit la veille à l'ouest et la suite rougit là-bas seule.
    env: { TZ: "Europe/Paris" },
    globalSetup: ["./src/db/seed.globalSetup.ts"],
    // Les tests d'intégration partagent une seule base : deux fichiers qui
    // écrivent en même temps s'entre-bloquent. Le noyau, lui, n'y perd rien.
    fileParallelism: false,
    // Un worktree d'agent laissé là contient une seconde copie de la suite :
    // sans cette ligne, `npm test` la ramasse et annonce le double de tests,
    // dont la moitié tourne sur du code périmé sous couvert d'une suite verte.
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
