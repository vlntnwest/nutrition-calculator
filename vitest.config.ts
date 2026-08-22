import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Le `@/*` de tsconfig n'est connu que du compilateur : Vitest a besoin qu'on
// le lui redise, sans quoi les tests ne résolvent pas ce que `tsc` accepte.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
