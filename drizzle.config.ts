import type { Config } from "drizzle-kit";

/**
 * Migrations are authored against the PostgreSQL dialect and are applied
 * identically to the local PGlite database (development) and to a real
 * PostgreSQL server (production) — see src/db/client.ts.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
} satisfies Config;
