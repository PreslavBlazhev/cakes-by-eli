"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { categories, productImages, products } from "@/db/schema";
import { keyFromUrl, storage, storeUploadedImage } from "@/lib/storage";
import { uniqueSlug } from "@/lib/slug";
import { parsePriceToCents } from "@/lib/format";
import { sanitizeText } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/session";
import { describeError, FAIL, OK } from "./types";
import type { ActionResult } from "./types";

const idSchema = z.uuid();

/** Public pages read the database on every request, so only the routes that
 *  Next may have cached need an explicit refresh. */
function revalidatePublic() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

const categorySchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(2, "Името е задължително.").max(80),
  slug: z.string().trim().max(64).optional().default(""),
  description: z.string().trim().max(600).optional().default(""),
  accent: z.enum(["rose", "chocolate", "gold", "sage", "blush"]).default("rose"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isVisible: z.boolean().default(true),
});

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = categorySchema.safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      slug: formData.get("slug") ?? "",
      description: formData.get("description") ?? "",
      accent: formData.get("accent") ?? "rose",
      sortOrder: formData.get("sortOrder") ?? 0,
      isVisible: formData.get("isVisible") === "on",
    });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    const existing = await db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories);

    const taken = existing
      .filter((c) => c.id !== values.id)
      .map((c) => c.slug);

    const slug = uniqueSlug(values.slug || values.name, taken);

    // An optional replacement picture travels with the rest of the form so the
    // owner never has to save twice.
    const upload = formData.get("image");
    let imagePath: string | null = null;

    if (upload instanceof File && upload.size > 0) {
      const stored = await storeUploadedImage(upload, "categories");
      if (!stored.ok) return FAIL(`Снимката не беше приета: ${stored.error}`);
      imagePath = stored.file.url;
    }

    if (values.id) {
      const previous = await db
        .select({ imagePath: categories.imagePath })
        .from(categories)
        .where(eq(categories.id, values.id))
        .limit(1);

      await db
        .update(categories)
        .set({
          name: sanitizeText(values.name),
          slug,
          description: sanitizeText(values.description),
          accent: values.accent,
          sortOrder: values.sortOrder,
          isVisible: values.isVisible,
          ...(imagePath ? { imagePath } : {}),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, values.id));

      // Replacing an uploaded picture removes the old file; the bundled demo
      // illustrations live in public/ and are left alone.
      const old = previous[0]?.imagePath;
      if (imagePath && old) {
        const key = keyFromUrl(old);
        if (key) await storage().remove(key);
      }

      revalidatePublic();
      return OK("Категорията е запазена.", values.id);
    }

    const [row] = await db
      .insert(categories)
      .values({
        name: sanitizeText(values.name),
        slug,
        description: sanitizeText(values.description),
        accent: values.accent,
        sortOrder: values.sortOrder,
        isVisible: values.isVisible,
        imagePath,
      })
      .returning({ id: categories.id });

    revalidatePublic();
    return OK("Категорията е създадена.", row.id);
  } catch (error) {
    console.error("saveCategory:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteCategory(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна категория.");

    const used = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, id.data))
      .limit(1);

    if (used.length > 0) {
      return FAIL(
        "Категорията не може да бъде изтрита, защото в нея има продукти. " +
          "Преместете ги или скрийте категорията.",
      );
    }

    await db.delete(categories).where(eq(categories.id, id.data));
    revalidatePublic();
    return OK("Категорията е изтрита.");
  } catch (error) {
    console.error("deleteCategory:", error);
    return FAIL(describeError(error));
  }
}

export async function reorderCategory(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = z
      .object({ id: idSchema, direction: z.enum(["up", "down"]) })
      .safeParse({
        id: formData.get("id"),
        direction: formData.get("direction"),
      });

    if (!parsed.success) return FAIL("Невалидна заявка.");

    const all = await db
      .select({ id: categories.id, sortOrder: categories.sortOrder })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const index = all.findIndex((c) => c.id === parsed.data.id);
    if (index === -1) return FAIL("Категорията не е намерена.");

    const swapWith = parsed.data.direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= all.length) return OK("Няма промяна.");

    await db.transaction(async (tx) => {
      // Rewrite the whole ordering so gaps and duplicates cannot accumulate.
      const reordered = [...all];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(swapWith, 0, moved);

      for (const [position, item] of reordered.entries()) {
        await tx
          .update(categories)
          .set({ sortOrder: position })
          .where(eq(categories.id, item.id));
      }
    });

    revalidatePublic();
    return OK("Подредбата е запазена.");
  } catch (error) {
    console.error("reorderCategory:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

const productSchema = z.object({
  id: idSchema.optional(),
  categoryId: idSchema,
  dessertTypeId: z.string().trim().optional().default(""),
  name: z.string().trim().min(2, "Името е задължително.").max(120),
  slug: z.string().trim().max(64).optional().default(""),
  shortDescription: z.string().trim().max(300).optional().default(""),
  description: z.string().trim().max(4000).optional().default(""),
  price: z.string().trim().optional().default(""),
  portions: z.string().trim().max(60).optional().default(""),
  weightGrams: z.string().trim().optional().default(""),
  availability: z.enum(["ACTIVE", "UNAVAILABLE", "SEASONAL", "HIDDEN"]),
  isFeatured: z.boolean().default(false),
  isCustomizable: z.boolean().default(false),
  ingredients: z.string().trim().max(2000).optional().default(""),
  allergens: z.array(z.string().trim().max(60)).max(20).default([]),
  allergenNote: z.string().trim().max(600).optional().default(""),
  shippingAllowed: z.boolean().default(false),
  pickupAllowed: z.boolean().default(true),
  shipWeightKg: z.string().trim().optional().default(""),
  shipLengthCm: z.string().trim().optional().default(""),
  shipWidthCm: z.string().trim().optional().default(""),
  shipHeightCm: z.string().trim().optional().default(""),
  packageCount: z.coerce.number().int().min(1).max(50).default(1),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

function optionalInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function optionalDecimal(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null;
}

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = productSchema.safeParse({
      id: formData.get("id") || undefined,
      categoryId: formData.get("categoryId"),
      dessertTypeId: formData.get("dessertTypeId") ?? "",
      name: formData.get("name"),
      slug: formData.get("slug") ?? "",
      shortDescription: formData.get("shortDescription") ?? "",
      description: formData.get("description") ?? "",
      price: formData.get("price") ?? "",
      portions: formData.get("portions") ?? "",
      weightGrams: formData.get("weightGrams") ?? "",
      availability: formData.get("availability") ?? "ACTIVE",
      isFeatured: formData.get("isFeatured") === "on",
      isCustomizable: formData.get("isCustomizable") === "on",
      ingredients: formData.get("ingredients") ?? "",
      allergens: formData.getAll("allergens").map(String),
      allergenNote: formData.get("allergenNote") ?? "",
      shippingAllowed: formData.get("shippingAllowed") === "on",
      pickupAllowed: formData.get("pickupAllowed") === "on",
      shipWeightKg: formData.get("shipWeightKg") ?? "",
      shipLengthCm: formData.get("shipLengthCm") ?? "",
      shipWidthCm: formData.get("shipWidthCm") ?? "",
      shipHeightCm: formData.get("shipHeightCm") ?? "",
      packageCount: formData.get("packageCount") ?? 1,
      sortOrder: formData.get("sortOrder") ?? 0,
    });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    const existing = await db
      .select({ id: products.id, slug: products.slug })
      .from(products);

    const slug = uniqueSlug(
      values.slug || values.name,
      existing.filter((p) => p.id !== values.id).map((p) => p.slug),
    );

    const record = {
      categoryId: values.categoryId,
      dessertTypeId: values.dessertTypeId || null,
      name: sanitizeText(values.name),
      slug,
      shortDescription: sanitizeText(values.shortDescription),
      description: sanitizeText(values.description),
      basePriceCents: values.price ? parsePriceToCents(values.price) : null,
      portions: values.portions ? sanitizeText(values.portions) : null,
      weightGrams: optionalInt(values.weightGrams),
      availability: values.availability,
      isFeatured: values.isFeatured,
      isCustomizable: values.isCustomizable,
      ingredients: sanitizeText(values.ingredients),
      allergens: values.allergens.filter(Boolean),
      allergenNote: sanitizeText(values.allergenNote),
      shippingAllowed: values.shippingAllowed,
      pickupAllowed: values.pickupAllowed,
      shipWeightKg: optionalDecimal(values.shipWeightKg),
      shipLengthCm: optionalInt(values.shipLengthCm),
      shipWidthCm: optionalInt(values.shipWidthCm),
      shipHeightCm: optionalInt(values.shipHeightCm),
      packageCount: values.packageCount,
      sortOrder: values.sortOrder,
      updatedAt: new Date(),
    };

    let productId = values.id;

    if (productId) {
      await db.update(products).set(record).where(eq(products.id, productId));
    } else {
      const [row] = await db
        .insert(products)
        .values(record)
        .returning({ id: products.id });
      productId = row.id;
    }

    // Images arrive on the same submission so the owner never has to save twice.
    const files = formData
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const rejected: string[] = [];
    for (const file of files) {
      const result = await storeUploadedImage(file, "products");
      if (!result.ok) {
        rejected.push(`${result.originalName}: ${result.error}`);
        continue;
      }
      await db.insert(productImages).values({
        productId,
        path: result.file.url,
        alt: sanitizeText(values.name),
        sortOrder: Date.now() % 100000,
      });
    }

    revalidatePublic();

    if (rejected.length > 0) {
      return FAIL(
        `Продуктът е запазен, но някои снимки бяха отхвърлени: ${rejected.join("; ")}`,
      );
    }

    return OK(values.id ? "Продуктът е запазен." : "Продуктът е създаден.", productId);
  } catch (error) {
    console.error("saveProduct:", error);
    return FAIL(describeError(error));
  }
}

/** Soft delete — the catalogue keeps its history and old orders still resolve. */
export async function archiveProduct(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалиден продукт.");

    await db
      .update(products)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(products.id, id.data));

    revalidatePublic();
    return OK("Продуктът е архивиран и вече не се показва в сайта.");
  } catch (error) {
    console.error("archiveProduct:", error);
    return FAIL(describeError(error));
  }
}

export async function restoreProduct(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалиден продукт.");

    await db
      .update(products)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(products.id, id.data));

    revalidatePublic();
    return OK("Продуктът е върнат в каталога.");
  } catch (error) {
    console.error("restoreProduct:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteProductImage(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("imageId"));
    if (!id.success) return FAIL("Невалидна снимка.");

    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.id, id.data))
      .limit(1);

    const image = rows[0];
    if (!image) return FAIL("Снимката не е намерена.");

    await db.delete(productImages).where(eq(productImages.id, id.data));

    const key = keyFromUrl(image.path);
    if (key) await storage().remove(key);

    revalidatePublic();
    revalidatePath(`/admin/products/${image.productId}`);
    return OK("Снимката е премахната.");
  } catch (error) {
    console.error("deleteProductImage:", error);
    return FAIL(describeError(error));
  }
}

/** Quick toggle used from the product list. */
export async function toggleProductVisibility(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалиден продукт.");

    const rows = await db
      .select({ availability: products.availability })
      .from(products)
      .where(eq(products.id, id.data))
      .limit(1);

    if (!rows[0]) return FAIL("Продуктът не е намерен.");

    const next = rows[0].availability === "HIDDEN" ? "ACTIVE" : "HIDDEN";

    await db
      .update(products)
      .set({ availability: next, updatedAt: new Date() })
      .where(eq(products.id, id.data));

    revalidatePublic();
    return OK(
      next === "HIDDEN"
        ? "Продуктът е скрит от сайта."
        : "Продуктът се показва в сайта.",
    );
  } catch (error) {
    console.error("toggleProductVisibility:", error);
    return FAIL(describeError(error));
  }
}

/** Removes every demo row the seed created, in one step. */
export async function clearDemoContent(): Promise<ActionResult> {
  try {
    await requireAdmin();

    const demoProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.isDemo, true));

    if (demoProducts.length === 0) {
      return OK("Няма демо продукти за премахване.");
    }

    await db.transaction(async (tx) => {
      for (const product of demoProducts) {
        const images = await tx
          .select({ path: productImages.path })
          .from(productImages)
          .where(eq(productImages.productId, product.id));

        for (const image of images) {
          const key = keyFromUrl(image.path);
          if (key) await storage().remove(key);
        }
      }
      await tx.delete(products).where(eq(products.isDemo, true));
    });

    revalidatePublic();
    return OK(`Премахнати са ${demoProducts.length} демо продукта.`);
  } catch (error) {
    console.error("clearDemoContent:", error);
    return FAIL(
      "Демо продуктите не можаха да бъдат премахнати. Възможно е по тях да има поръчки.",
    );
  }
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] = issue.message;
  return out;
}

/** Products still selectable for a new order — used by the admin pickers. */
export async function countLiveProducts(): Promise<number> {
  await requireAdmin();
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(sql`${isNull(products.archivedAt)} and ${ne(products.availability, "HIDDEN")}`);
  return rows.length;
}

/** Removes a category picture, falling back to the plain gradient card. */
export async function clearCategoryImage(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна категория.");

    const rows = await db
      .select({ imagePath: categories.imagePath })
      .from(categories)
      .where(eq(categories.id, id.data))
      .limit(1);

    if (!rows[0]) return FAIL("Категорията не е намерена.");

    await db
      .update(categories)
      .set({ imagePath: null, updatedAt: new Date() })
      .where(eq(categories.id, id.data));

    const key = rows[0].imagePath ? keyFromUrl(rows[0].imagePath) : "";
    if (key) await storage().remove(key);

    revalidatePublic();
    return OK("Снимката на категорията е премахната.");
  } catch (error) {
    console.error("clearCategoryImage:", error);
    return FAIL(describeError(error));
  }
}
