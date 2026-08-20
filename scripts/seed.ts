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
 * Idempotent seed.
 *
 * By default it only fills in what is missing, so running it against a live
 * database never overwrites content the owner has edited. The flags below opt
 * into the destructive behaviour explicitly.
 *
 *   --demo-prices     apply the example prices from seed-data.ts
 *   --reset-config    re-sync the configurator definitions (drops customisation
 *                     groups/options/rules for the seeded dessert types)
 *   --force-content   overwrite site settings and working hours
 *   --no-demo         skip demo products and gallery artwork
 */
const flags = new Set(process.argv.slice(2));
const withDemoPrices = flags.has("--demo-prices");
const resetConfig = flags.has("--reset-config");
const forceContent = flags.has("--force-content");
const skipDemo = flags.has("--no-demo");

const log = (message: string) => console.log(`  ${message}`);

async function main() {
  console.log("\n▸ Seed за Cakes by ELI\n");

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
  }

  console.log("\n✓ Seed приключи.\n");

  if (!withDemoPrices) {
    console.log(
      "  Бележка: цените са оставени празни, за да не се показват измислени суми.\n" +
        "  Стартирайте `npm run db:seed -- --demo-prices` за примерни цени в разработка.\n",
    );
  }
  process.exit(0);
}

/* ------------------------------------------------------------------ */

async function seedSettings() {
  const existing = await db
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1));

  if (existing.length > 0 && !forceContent) {
    log("Настройките вече съществуват — пропуснати.");
    return;
  }

  const values = { id: 1, ...BUSINESS, updatedAt: new Date() };

  if (existing.length === 0) {
    await db.insert(siteSettings).values(values);
    log("Настройките на сайта са създадени.");
  } else {
    await db.update(siteSettings).set(values).where(eq(siteSettings.id, 1));
    log("Настройките на сайта са презаписани (--force-content).");
  }
}

async function seedWorkingHours() {
  const existing = await db.select({ weekday: workingHours.weekday }).from(workingHours);

  if (existing.length > 0 && !forceContent) {
    log("Работното време вече е зададено — пропуснато.");
    return;
  }

  if (existing.length > 0) await db.delete(workingHours);

  await db.insert(workingHours).values(DEFAULT_WORKING_HOURS);
  log(
    "Работното време е попълнено с примерни стойности — потвърдете ги с клиента.",
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

  log(`Категории: ${created} добавени, ${bySlug.size} общо.`);
  return bySlug;
}

async function seedDessertTypes(
  categoryIds: Map<string, string>,
): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: dessertTypes.id, slug: dessertTypes.slug })
    .from(dessertTypes);
  const bySlug = new Map(existing.map((d) => [d.slug, d.id]));

  let created = 0;
  let resynced = 0;

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
    } else {
      continue;
    }

    await insertConfiguration(typeId, type);
  }

  log(
    `Видове десерти: ${created} добавени${resynced > 0 ? `, ${resynced} пресинхронизирани` : ""}, ${bySlug.size} общо.`,
  );
  return bySlug;
}

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

    if (!group.options?.length) continue;

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
    log(
      "Админ акаунт: пропуснат (ADMIN_EMAIL / ADMIN_PASSWORD_HASH не са зададени).",
    );
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
    await db
      .update(adminUsers)
      .set({
        passwordHash: env.ADMIN_PASSWORD_HASH,
        name: env.ADMIN_NAME ?? "Администратор",
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, existing[0].id));
    log(`Админ акаунт: ${email} — паролата е обновена.`);
    return;
  }

  await db.insert(adminUsers).values({
    email: env.ADMIN_EMAIL,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    name: env.ADMIN_NAME ?? "Администратор",
  });
  log(`Админ акаунт: ${email} — създаден.`);
}

async function seedDemoProducts(
  categoryIds: Map<string, string>,
  dessertTypeIds: Map<string, string>,
) {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    log("Продукти вече съществуват — демо продуктите са пропуснати.");
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

  log(`Демо продукти: ${created} добавени, със заместващи илюстрации.`);
}

/**
 * Draws a placeholder illustration for one product and attaches it.
 *
 * A catalogue of empty coloured rectangles reads as broken, so every demo
 * product ships with an original vector illustration of its dessert kind
 * until a real photograph replaces it from the admin panel.
 */
async function writeProductArtwork(
  productId: string,
  slug: string,
  name: string,
  dessertTypeSlug: string | null,
) {
  const dir = path.join(process.cwd(), "public", "demo", "products");
  fs.mkdirSync(dir, { recursive: true });

  const file = `${slug}.svg`;
  fs.writeFileSync(
    path.join(dir, file),
    renderProductArtwork(artworkKindForDessert(dessertTypeSlug), name),
    "utf8",
  );

  await db.insert(productImages).values({
    productId,
    path: `/demo/products/${file}`,
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
    log(`Илюстрации на продукти: ${created} добавени за съществуващи демо продукти.`);
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

  const dir = path.join(process.cwd(), "public", "demo", "categories");
  fs.mkdirSync(dir, { recursive: true });

  let created = 0;
  for (const category of rows) {
    if (category.imagePath) continue;

    const file = `${category.slug}.svg`;
    fs.writeFileSync(
      path.join(dir, file),
      renderProductArtwork(artworkKindForCategory(category.slug), category.name),
      "utf8",
    );

    await db
      .update(categories)
      .set({ imagePath: `/demo/categories/${file}`, updatedAt: new Date() })
      .where(eq(categories.id, category.id));
    created += 1;
  }

  if (created > 0) log(`Илюстрации на категории: ${created} добавени.`);
}

async function seedDemoGallery(categoryIds: Map<string, string>) {
  const existing = await db
    .select({ id: galleryItems.id })
    .from(galleryItems)
    .limit(1);
  if (existing.length > 0) {
    log("Галерията вече има съдържание — демо снимките са пропуснати.");
    return;
  }

  const dir = path.join(process.cwd(), "public", "demo");
  fs.mkdirSync(dir, { recursive: true });

  let created = 0;
  for (const [index, item] of DEMO_GALLERY.entries()) {
    const file = `gallery-${index + 1}.svg`;
    fs.writeFileSync(
      path.join(dir, file),
      renderDemoArtwork(index, item.caption),
      "utf8",
    );

    await db.insert(galleryItems).values({
      path: `/demo/${file}`,
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

  log(
    `Демо галерия: ${created} изображения (собствени SVG композиции, за подмяна с реални снимки).`,
  );
}

main().catch((error) => {
  console.error("\n✗ Seed се провали:", error);
  process.exit(1);
});
