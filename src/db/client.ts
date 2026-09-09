import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/**
 * The application talks to PostgreSQL through a single Drizzle interface.
 *
 * - With `DATABASE_URL` set it connects to a real PostgreSQL server via
 *   node-postgres. This is the production path.
 * - Without it, an embedded PGlite instance is used: PGlite *is* PostgreSQL
 *   (compiled to WASM), so the very same migrations and SQL run locally with
 *   no database server to install. Development and CI only.
 *
 * Both drivers expose the identical Drizzle query API, so the PGlite handle is
 * narrowed to the node-postgres type at this single boundary rather than
 * leaking a union through every call site.
 */

declare global {
  var __cbeDb: Database | undefined;
  var __cbePool: Pool | undefined;
  var __cbePglite: PGlite | undefined;
}

/**
 * Opens the production pool and attaches its one error listener.
 *
 * `pg.Pool` is an EventEmitter that emits `'error'` when an *idle* client dies
 * — a database restart, an expired TCP idle, a network blip. An EventEmitter
 * with no listener for `'error'` throws, which takes the whole Node process
 * down; on Render that looks indistinguishable from an out-of-memory kill in
 * the Events list. The listener is attached exactly here, in the branch that
 * constructs the pool, so a reused pool never accumulates a second one.
 */
function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 10,
    // Fail a request that cannot get a connection instead of hanging on it
    // forever while holding whatever it has already allocated.
    connectionTimeoutMillis: 10_000,
    // Explicit rather than relying on the driver default.
    idleTimeoutMillis: 30_000,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  pool.on("error", (error: Error) => {
    // Message only. The connection string, the credentials inside it and the
    // failing query never reach the log.
    console.error(
      JSON.stringify({
        tag: "PG_POOL_ERROR",
        message: error.message,
      }),
    );
  });

  return pool;
}

function createDatabase(): Database {
  if (env.DATABASE_URL) {
    const pool = globalThis.__cbePool ?? createPool(env.DATABASE_URL);
    globalThis.__cbePool = pool;
    return drizzleNode(pool, { schema });
  }

  // The bundler cannot statically resolve this path; it is only ever taken on
  // the development/CI fallback branch, so tracing the whole project would be
  // wasted work.
  const dir = path.isAbsolute(env.PGLITE_DIR)
    ? env.PGLITE_DIR
    : path.join(/* turbopackIgnore: true */ process.cwd(), env.PGLITE_DIR);

  // PGlite creates its own data directory but not the parents above it.
  fs.mkdirSync(path.dirname(dir), { recursive: true });

  const client = globalThis.__cbePglite ?? new PGlite(dir);
  globalThis.__cbePglite = client;

  return drizzlePglite(client, { schema }) as unknown as Database;
}

function resolveDatabase(): Database {
  const existing = globalThis.__cbeDb;
  if (existing) return existing;

  const created = createDatabase();
  globalThis.__cbeDb = created;
  return created;
}

/**
 * Resolved on first use rather than on import.
 *
 * `next build` spawns several worker processes that import server modules
 * without ever querying; opening a connection pool — or, worse, a
 * single-writer PGlite data directory — in each of them is both wasteful and
 * a source of spurious errors. The proxy keeps the familiar `db.select(…)`
 * call style while deferring that cost to the first real query.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const instance = resolveDatabase() as unknown as Record<
      string | symbol,
      unknown
    >;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in (resolveDatabase() as unknown as object);
  },
});

export { schema };
