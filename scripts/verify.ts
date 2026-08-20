import "./_bootstrap";

import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db/client";
import {
  categories,
  customizationGroups,
  customizationOptions,
  dessertTypes,
  products,
  siteSettings,
} from "@/db/schema";

/**
 * Post-seed sanity check.
 *
 * A deploy that promotes a release against an empty database gives the visitor
 * a site with no menu and a configurator that leads nowhere — and it does so
 * silently, because every page still renders and returns 200. This turns that
 * silent failure into a failed deploy: Render keeps the previous release
 * running when the pre-deploy command exits non-zero.
 *
 * Only content that must exist for the site to function is checked. Anything
 * the owner is free to empty out (gallery, orders, working-hour exceptions) is
 * deliberately not required.
 */
const log = (message: string) => console.log(`[verify] ${message}`);

type Check = {
  label: string;
  table: PgTable;
  /** Minimum row count for the site to be usable. */
  min: number;
};

const CHECKS: Check[] = [
  { label: "site_settings", table: siteSettings, min: 1 },
  { label: "categories", table: categories, min: 1 },
  { label: "dessert_types", table: dessertTypes, min: 1 },
  { label: "customization_groups", table: customizationGroups, min: 1 },
  { label: "customization_options", table: customizationOptions, min: 1 },
  { label: "products", table: products, min: 1 },
];

async function main() {
  log("Starting...");

  const failures: string[] = [];

  for (const check of CHECKS) {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(check.table);
    const total = row?.total ?? 0;

    if (total >= check.min) {
      log(`${check.label}: ${total} OK`);
    } else {
      log(`${check.label}: ${total} — expected at least ${check.min} FAIL`);
      failures.push(check.label);
    }
  }

  if (failures.length > 0) {
    log(`FAILED — empty required tables: ${failures.join(", ")}`);
    log("Run `npm run db:seed` against this database before deploying.");
    process.exit(1);
  }

  log("Completed successfully");
  process.exit(0);
}

main().catch((error) => {
  log("FAILED");
  console.error(error);
  process.exit(1);
});
