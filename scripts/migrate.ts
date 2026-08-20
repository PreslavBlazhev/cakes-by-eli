import "./_bootstrap";

import path from "node:path";
import { migrate as migrateNode } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { db } from "@/db/client";
import { env } from "@/lib/env";

async function main() {
  const folder = path.join(process.cwd(), "drizzle");
  const target = env.DATABASE_URL
    ? "PostgreSQL сървър"
    : `вградена PGlite база (${env.PGLITE_DIR})`;

  console.log(`▸ Прилагане на миграции към ${target}…`);

  if (env.DATABASE_URL) {
    await migrateNode(db, { migrationsFolder: folder });
  } else {
    // Same SQL, same dialect — only the driver differs.
    await migratePglite(
      db as unknown as Parameters<typeof migratePglite>[0],
      { migrationsFolder: folder },
    );
  }

  console.log("✓ Миграциите са приложени успешно.");
  process.exit(0);
}

main().catch((error) => {
  console.error("✗ Миграцията се провали:", error);
  process.exit(1);
});
