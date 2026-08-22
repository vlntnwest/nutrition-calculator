// Lancé par tsx et non par node nu, contrairement aux autres scripts : il
// traverse src/db/, qui importe en `@/` — un alias que seul un bundler résout.
import { seed } from "@/db/seed";

async function main() {
  await seed();
  console.log("Catalogue écrit.");
  process.exit(0);
}

main();
