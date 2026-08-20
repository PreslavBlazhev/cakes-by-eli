import "./_bootstrap";

import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  adminUsers,
  categories,
  customizationGroups,
  customizationOptions,
  customizationRules,
  dessertTypes,
  galleryItems,
  productImages,
  products,
  siteSettings,
  workingHours,
} from "@/db/schema";
import { env } from "@/lib/env";
import { DEFAULT_WORKING_HOURS } from "@/lib/schedule";
import {
  BUSINESS,
  CATEGORIES,
  DEMO_GALLERY,
  DEMO_PRODUCTS,
  DESSERT_TYPES,
} from "./seed-data";
import { renderDemoArtwork } from "./demo-artwork";
import {
  artworkKindForCategory,
  artworkKindForDessert,
  renderProductArtwork,
} from "./product-artwork";

/**
 * Idempotent seed — safe to run on every deploy.
 *
 * The contract is deliberately narrow: the seed creates the initial catalogue
 * and configurator definitions when they are missing, and never overwrites
 * business data that the owner has edited from the admin panel. Re-running it
 * against a live database is therefore a no-op apart from repairing gaps.
 *
 * Destructive behaviour is opt-in only, through the flags below, and none of
 * them is used by the Render deploy.
 *
 *   --demo-prices     apply the example prices from seed-data.ts
 *   --reset-config    re-sync the configurator definitions (drops customisation
 *                     groups/options/rules for the seeded dessert types)
 *   --force-content   overwrite site settings and working hours
 *   --force-admin     rewrite the admin password hash from the environment
 *   --no-demo         skip demo products and gallery artwork
 */
const flags = new Set(process.argv.slice(2));
const withDemoPrices = flags.has("--demo-prices");
const resetConfig = flags.has("--reset-config");
const forceContent = flags.has("--force-content");
const forceAdmin = flags.has("--force-admin");
const skipDemo = flags.has("--no-demo");

/**
 * One line per step, prefixed so it is greppable in Render's deploy log.
 * Nothing here may include a password hash, an API key or a connection string.
 */
const log = (message: string) => console.log(`[seed] ${message}`);

async function main() {
  log("Starting...");

  await seedSettings();
  await seedWorkingHours();
  const categoryIds = await seedCategories();
  const dessertTypeIds = await seedDessertTypes(categoryIds);
  await seedAdmin();

  if (!skipDemo) {
    await seedDemoProducts(categoryIds, dessertTypeIds);
    await backfillProductArtwork();
    await seedCategoryArtwork();
    await seedDemoGallery(categoryIds);
    log(
      `Demo imagery: ${artwork.photos} committed photos / ` +
        `${artwork.generated} generated illustrations`,
    );
  } else {
    log("Demo content: skipped (--no-demo)");
  }

  if (!withDemoPrices) {
    log("Prices: left empty on purpose — set them from the admin panel");
  }

  log("Completed successfully");
  process.exit(0);
}

/* ------------------------------------------------------------------ */

async function seedSettings() {
  const existing = await db
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1));

  if (existing.length > 0 && !forceContent) {
    log("Site settings: existing");
    return;
  }

  const values = { id: 1, ...BUSINESS, updatedAt: new Date() };

  if (existing.length === 0) {
    await db.insert(siteSettings).values(values);
    log("Site settings: created");
  } else {
    await db.update(siteSettings).set(values).where(eq(siteSettings.id, 1));
    log("Site settings: overwritten (--force-content)");
  }
}

async function seedWorkingHours() {
  const existing = await db.select({ weekday: workingHours.weekday }).from(workingHours);

  if (existing.length > 0 && !forceContent) {
    log("Working hours: existing");
    return;
  }

  if (existing.length > 0) await db.delete(workingHours);

  await db.insert(workingHours).values(DEFAULT_WORKING_HOURS);
  log(
    `Working hours: ${DEFAULT_WORKING_HOURS.length} defaults written — confirm them with the owner`,
  );
}

async function seedCategories(): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const bySlug = new Map(existing.map((c) => [c.slug, c.id]));

  let created = 0;
  for (const [index, category] of CATEGORIES.entries()) {
    if (bySlug.has(category.slug)) continue;
    const [row] = await db
      .insert(categories)
      .values({ ...category, sortOrder: index })
      .returning({ id: categories.id });
    bySlug.set(category.slug, row.id);
    created += 1;
  }

  log(
    `Categories: ${created} created / ${existing.length} existing / ${bySlug.size} total`,
  );
  return bySlug;
}

async function seedDessertTypes(
  categoryIds: Map<string, string>,
): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: dessertTypes.id, slug: dessertTypes.slug })
    .from(dessertTypes);
  const bySlug = new Map(existing.map((d) => [d.slug, d.id]));

  // A dessert type whose customisation groups are missing is what an
  // interrupted seed leaves behind — the type row is committed, the groups are
  // not, and the configurator then offers a dessert with no steps. Those are
  // repaired below; types that already carry groups are never touched, because
  // the owner may have edited them.
  const groupCounts = new Map<string, number>(
    (
      await db
        .select({
          dessertTypeId: customizationGroups.dessertTypeId,
          total: sql<number>`count(*)::int`,
        })
        .from(customizationGroups)
        .groupBy(customizationGroups.dessertTypeId)
    ).map((row) => [row.dessertTypeId, row.total]),
  );

  let created = 0;
  let resynced = 0;
  let repaired = 0;

  for (const [index, type] of DESSERT_TYPES.entries()) {
    let typeId = bySlug.get(type.slug);

    const basePriceCents = withDemoPrices
      ? (type.demoBasePriceCents ?? null)
      : null;

    if (!typeId) {
      const [row] = await db
        .insert(dessertTypes)
        .values({
          slug: type.slug,
          name: type.name,
          renderer: type.renderer,
          description: type.description,
          basePriceCents,
          categoryId: categoryIds.get(type.categorySlug) ?? null,
          sortOrder: index,
        })
        .returning({ id: dessertTypes.id });
      typeId = row.id;
      bySlug.set(type.slug, typeId);
      created += 1;
    } else if (resetConfig) {
      await db
        .update(dessertTypes)
        .set({ basePriceCents, updatedAt: new Date() })
        .where(eq(dessertTypes.id, typeId));
      await db
        .delete(customizationGroups)
        .where(eq(customizationGroups.dessertTypeId, typeId));
      await db
        .delete(customizationRules)
        .where(eq(customizationRules.dessertTypeId, typeId));
      resynced += 1;
    } else if ((groupCounts.get(typeId) ?? 0) === 0) {
      // Left half-written by an interrupted run — finish the job. Stale rules
      // from that same run would otherwise duplicate, so they go first.
      await db
        .delete(customizationRules)
        .where(eq(customizationRules.dessertTypeId, typeId));
      repaired += 1;
    } else {
      continue;
    }

    await insertConfiguration(typeId, type);
  }

  const parts = [`${created} created`, `${existing.length} existing`];
  if (repaired > 0) parts.push(`${repaired} repaired`);
  if (resynced > 0) parts.push(`${resynced} re-synced`);
  log(`Dessert types: ${parts.join(" / ")} / ${bySlug.size} total`);
  log(
    `Customization groups: ${config.groups} created, ` +
      `options: ${config.options} created, rules: ${config.rules} created`,
  );
  return bySlug;
}

/** Rows written by insertConfiguration, tallied for the deploy log. */
const config = { groups: 0, options: 0, rules: 0 };

async function insertConfiguration(
  typeId: string,
  type: (typeof DESSERT_TYPES)[number],
) {
  for (const [groupIndex, group] of type.groups.entries()) {
    const [groupRow] = await db
      .insert(customizationGroups)
      .values({
        dessertTypeId: typeId,
        key: group.key,
        label: group.label,
        helpText: group.helpText ?? "",
        inputType: group.inputType ?? "SINGLE",
        isRequired: group.isRequired ?? false,
        minSelect: group.minSelect ?? (group.isRequired ? 1 : 0),
        maxSelect:
          group.maxSelect ?? (group.inputType === "MULTI" ? 3 : 1),
        maxLength: group.maxLength ?? null,
        placeholder: group.placeholder ?? "",
        previewChannel: group.previewChannel ?? "",
        step: group.step,
        sortOrder: groupIndex,
      })
      .returning({ id: customizationGroups.id });

    config.groups += 1;

    if (!group.options?.length) continue;

    config.options += group.options.length;

    await db.insert(customizationOptions).values(
      group.options.map((option, optionIndex) => ({
        groupId: groupRow.id,
        key: option.key,
        label: option.label,
        description: option.description ?? "",
        priceModifierCents: withDemoPrices
          ? (option.demoPriceCents ?? null)
          : null,
        previewValue: option.previewValue ?? "",
        swatchColor: option.swatchColor ?? null,
        sortOrder: optionIndex,
      })),
    );
  }

  if (type.rules?.length) {
    config.rules += type.rules.length;

    await db.insert(customizationRules).values(
      type.rules.map((rule) => ({
        dessertTypeId: typeId,
        targetType: rule.targetType,
        targetKey: rule.targetKey,
        targetGroupKey: rule.targetGroupKey ?? null,
        mode: rule.mode ?? "SHOW_WHEN",
        whenGroupKey: rule.whenGroupKey,
        whenOptionKeys: rule.whenOptionKeys,
      })),
    );
  }
}

async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    log("Admin: skipped (ADMIN_EMAIL / ADMIN_PASSWORD_HASH not set)");
    return;
  }

  if (!env.ADMIN_PASSWORD_HASH.startsWith("scrypt$")) {
    throw new Error(
      "ADMIN_PASSWORD_HASH не изглежда като хеш. Генерирайте го с `npm run admin:hash -- \"парола\"`.",
    );
  }

  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${email}`);

  if (existing.length > 0) {
    // The account is business data once it exists. Silently re-applying the
    // hash from the environment on every deploy would undo a password the
    // owner changed herself, and would resurrect the account's original
    // password from a stale Render variable — so rotation is opt-in.
    if (!forceAdmin) {
      log(`Admin: existing (${email})`);
      return;
    }

    await db
      .update(adminUsers)
      .set({
        passwordHash: env.ADMIN_PASSWORD_HASH,
        name: env.ADMIN_NAME ?? "Администратор",
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, existing[0].id));
    log(`Admin: password rotated (${email}, --force-admin)`);
    return;
  }

  await db.insert(adminUsers).values({
    email: env.ADMIN_EMAIL,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    name: env.ADMIN_NAME ?? "Администратор",
  });
  log(`Admin: created (${email})`);
}

async function seedDemoProducts(
  categoryIds: Map<string, string>,
  dessertTypeIds: Map<string, string>,
) {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    log("Products: existing");
    return;
  }

  let created = 0;
  for (const [index, product] of DEMO_PRODUCTS.entries()) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) continue;

    const [row] = await db
      .insert(products)
      .values({
      slug: product.slug,
      categoryId,
      dessertTypeId: product.dessertTypeSlug
        ? (dessertTypeIds.get(product.dessertTypeSlug) ?? null)
        : null,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      basePriceCents: withDemoPrices ? (product.demoPriceCents ?? null) : null,
      portions: product.portions ?? null,
      isFeatured: product.isFeatured ?? false,
      isCustomizable: product.isCustomizable ?? false,
      shippingAllowed: product.shippingAllowed ?? false,
      pickupAllowed: true,
      shipWeightKg: product.shipWeightKg ?? null,
      shipLengthCm: product.shipLengthCm ?? null,
      shipWidthCm: product.shipWidthCm ?? null,
      shipHeightCm: product.shipHeightCm ?? null,
      sortOrder: index,
      isDemo: true,
      })
      .returning({ id: products.id });

    await writeProductArtwork(row.id, product.slug, product.name, product.dessertTypeSlug ?? null);
    created += 1;
  }

  log(`Products: ${created} created`);
}

/**
 * Resolves the version-controlled demo photograph for an asset, if there is
 * one.
 *
 * Render mounts a persistent disk at public/uploads and nowhere else, and the
 * pre-deploy step runs on a filesystem that is thrown away before the release
 * goes live. Anything the seed writes into public/demo at deploy time would
 * therefore vanish and leave the catalogue full of broken images. The JPEGs
 * committed under public/demo ship inside the build itself, so preferring them
 * is what makes the demo content survive a redeploy — the generated SVG stays
 * as a fallback for assets that have no photograph yet.
 */
function committedPhoto(dir: string, name: string): string | null {
  const file = `${name}.jpg`;
  const onDisk = path.join(process.cwd(), "public", "demo", dir, file);
  return fs.existsSync(onDisk) ? `/demo/${dir}/${file}` : null;
}

/** Counts how the demo imagery was resolved, for the deploy log. */
const artwork = { photos: 0, generated: 0 };

/**
 * Attaches the demo image for one product.
 *
 * A catalogue of empty coloured rectangles reads as broken, so every demo
 * product ships with imagery — the committed photograph when there is one, an
 * original vector illustration of its dessert kind otherwise — until a real
 * photograph replaces it from the admin panel.
 */
async function writeProductArtwork(
  productId: string,
  slug: string,
  name: string,
  dessertTypeSlug: string | null,
) {
  let publicPath = committedPhoto("products", slug);

  if (publicPath) {
    artwork.photos += 1;
  } else {
    const dir = path.join(process.cwd(), "public", "demo", "products");
    fs.mkdirSync(dir, { recursive: true });

    const file = `${slug}.svg`;
    fs.writeFileSync(
      path.join(dir, file),
      renderProductArtwork(artworkKindForDessert(dessertTypeSlug), name),
      "utf8",
    );
    publicPath = `/demo/products/${file}`;
    artwork.generated += 1;
  }

  await db.insert(productImages).values({
    productId,
    path: publicPath,
    alt: name,
    sortOrder: 0,
  });
}

/**
 * Backfills artwork for demo products that predate it, so an existing
 * installation is fixed by re-running the seed rather than by a reset.
 */
async function backfillProductArtwork() {
  const demoProducts = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      dessertTypeId: products.dessertTypeId,
    })
    .from(products)
    .where(eq(products.isDemo, true));

  if (demoProducts.length === 0) return;

  const withImages = new Set(
    (
      await db
        .select({ productId: productImages.productId })
        .from(productImages)
    ).map((row) => row.productId),
  );

  const typeSlugs = new Map(
    (
      await db
        .select({ id: dessertTypes.id, slug: dessertTypes.slug })
        .from(dessertTypes)
    ).map((row) => [row.id, row.slug]),
  );

  let created = 0;
  for (const product of demoProducts) {
    if (withImages.has(product.id)) continue;
    await writeProductArtwork(
      product.id,
      product.slug,
      product.name,
      product.dessertTypeId ? (typeSlugs.get(product.dessertTypeId) ?? null) : null,
    );
    created += 1;
  }

  if (created > 0) {
    log(`Product images: ${created} backfilled`);
  }
}

/** Categories without a picture get one too — the menu is a grid of cards. */
async function seedCategoryArtwork() {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      imagePath: categories.imagePath,
    })
    .from(categories);

  let created = 0;
  for (const category of rows) {
    if (category.imagePath) continue;

    let publicPath = committedPhoto("categories", category.slug);

    if (publicPath) {
      artwork.photos += 1;
    } else {
      const dir = path.join(process.cwd(), "public", "demo", "categories");
      fs.mkdirSync(dir, { recursive: true });

      const file = `${category.slug}.svg`;
      fs.writeFileSync(
        path.join(dir, file),
        renderProductArtwork(
          artworkKindForCategory(category.slug),
          category.name,
        ),
        "utf8",
      );
      publicPath = `/demo/categories/${file}`;
      artwork.generated += 1;
    }

    await db
      .update(categories)
      .set({ imagePath: publicPath, updatedAt: new Date() })
      .where(eq(categories.id, category.id));
    created += 1;
  }

  log(`Category images: ${created} attached`);
}

async function seedDemoGallery(categoryIds: Map<string, string>) {
  const existing = await db
    .select({ id: galleryItems.id })
    .from(galleryItems)
    .limit(1);
  if (existing.length > 0) {
    log("Gallery: existing");
    return;
  }

  let created = 0;
  for (const [index, item] of DEMO_GALLERY.entries()) {
    let publicPath = committedPhoto("gallery", `photo-${index + 1}`);

    if (publicPath) {
      artwork.photos += 1;
    } else {
      const dir = path.join(process.cwd(), "public", "demo");
      fs.mkdirSync(dir, { recursive: true });

      const file = `gallery-${index + 1}.svg`;
      fs.writeFileSync(
        path.join(dir, file),
        renderDemoArtwork(index, item.caption),
        "utf8",
      );
      publicPath = `/demo/${file}`;
      artwork.generated += 1;
    }

    await db.insert(galleryItems).values({
      path: publicPath,
      caption: item.caption,
      categoryId: categoryIds.get(item.categorySlug) ?? null,
      width: 900,
      height: 1100,
      isFeatured: index < 4,
      sortOrder: index,
      isDemo: true,
    });
    created += 1;
  }

  log(`Gallery: ${created} created`);
}

main().catch((error) => {
  // A non-zero exit is what stops Render from promoting a release whose
  // database never got its content.
  log("FAILED");
  console.error(error);
  process.exit(1);
});
