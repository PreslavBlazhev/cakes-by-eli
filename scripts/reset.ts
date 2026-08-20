import "./_bootstrap";

import fs from "node:fs";
import path from "node:path";

import { env } from "@/lib/env";

/**
 * Deletes the local development database so `db:migrate` can rebuild it.
 * Refuses to touch a real PostgreSQL server.
 */
const dir = path.isAbsolute(env.PGLITE_DIR)
  ? env.PGLITE_DIR
  : path.join(process.cwd(), env.PGLITE_DIR);

if (env.DATABASE_URL) {
  console.error(
    "✗ DATABASE_URL е зададен. Този скрипт нулира само локалната PGlite база.",
  );
  process.exit(1);
}

if (!fs.existsSync(dir)) {
  console.log("Нищо за изтриване — локалната база не съществува.");
  process.exit(0);
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(`✓ Локалната база е изтрита (${env.PGLITE_DIR}).`);
console.log("  Стартирайте `npm run db:migrate` и `npm run db:seed`.");
