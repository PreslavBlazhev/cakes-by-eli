import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { db } from "@/db/client";
import {
  categories,
  dessertTypes,
  productImages,
  products,
} from "@/db/schema";
import { ORDERABLE_AVAILABILITY } from "@/lib/labels";

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type DessertType = typeof dessertTypes.$inferSelect;

export type ProductWithMedia = Product & {
  images: ProductImage[];
  category: Pick<Category, "id" | "name" | "slug" | "accent">;
};

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

export async function listPublicCategories(): Promise<
  (Category & { productCount: number })[]
> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ categoryId: products.categoryId, id: products.id })
    .from(products)
    .where(
      and(
        isNull(products.archivedAt),
        ne(products.availability, "HIDDEN"),
        inArray(
          products.categoryId,
          rows.map((r) => r.id),
        ),
      ),
    );

  const byCategory = new Map<string, number>();
  for (const row of counts) {
    byCategory.set(row.categoryId, (byCategory.get(row.categoryId) ?? 0) + 1);
  }

  return rows.map((c) => ({ ...c, productCount: byCategory.get(c.id) ?? 0 }));
}

export async function listAllCategories(): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

async function attachMedia(rows: Product[]): Promise<ProductWithMedia[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const categoryIds = [...new Set(rows.map((r) => r.categoryId))];

  const [images, cats] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder)),
    db.select().from(categories).where(inArray(categories.id, categoryIds)),
  ]);

  const imagesByProduct = new Map<string, ProductImage[]>();
  for (const image of images) {
    const list = imagesByProduct.get(image.productId);
    if (list) list.push(image);
    else imagesByProduct.set(image.productId, [image]);
  }

  const categoryById = new Map(cats.map((c) => [c.id, c]));

  return rows.map((product) => {
    const category = categoryById.get(product.categoryId);
    return {
      ...product,
      images: imagesByProduct.get(product.id) ?? [],
      category: {
        id: category?.id ?? product.categoryId,
        name: category?.name ?? "",
        slug: category?.slug ?? "",
        accent: category?.accent ?? "rose",
      },
    };
  });
}

/** Everything a visitor may see: archived and HIDDEN products are excluded. */
export async function listPublicProducts(options?: {
  categoryId?: string;
  featuredOnly?: boolean;
  limit?: number;
}): Promise<ProductWithMedia[]> {
  const conditions = [
    isNull(products.archivedAt),
    ne(products.availability, "HIDDEN"),
  ];
  if (options?.categoryId) {
    conditions.push(eq(products.categoryId, options.categoryId));
  }
  if (options?.featuredOnly) {
    conditions.push(eq(products.isFeatured, true));
  }

  const query = db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.sortOrder), asc(products.name));

  const rows = options?.limit ? await query.limit(options.limit) : await query;
  return attachMedia(rows);
}

export async function getPublicProductBySlug(
  slug: string,
): Promise<ProductWithMedia | null> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.slug, slug),
        isNull(products.archivedAt),
        ne(products.availability, "HIDDEN"),
      ),
    )
    .limit(1);

  const [withMedia] = await attachMedia(rows);
  return withMedia ?? null;
}

/**
 * Resolves a product id that arrived from an untrusted query string.
 * Returns null unless the product exists and is genuinely orderable.
 */
export async function getOrderableProduct(
  id: string,
): Promise<ProductWithMedia | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        isNull(products.archivedAt),
        inArray(products.availability, ORDERABLE_AVAILABILITY),
      ),
    )
    .limit(1);

  const [withMedia] = await attachMedia(rows);
  return withMedia ?? null;
}

export async function listAdminProducts(): Promise<ProductWithMedia[]> {
  const rows = await db
    .select()
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.name));
  return attachMedia(rows);
}

export async function getAdminProduct(
  id: string,
): Promise<ProductWithMedia | null> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const [withMedia] = await attachMedia(rows);
  return withMedia ?? null;
}

/* ------------------------------------------------------------------ *
 * Dessert types
 * ------------------------------------------------------------------ */

export async function listDessertTypes(
  activeOnly = true,
): Promise<DessertType[]> {
  const query = db.select().from(dessertTypes);
  const rows = activeOnly
    ? await query
        .where(eq(dessertTypes.isActive, true))
        .orderBy(asc(dessertTypes.sortOrder), asc(dessertTypes.name))
    : await query.orderBy(asc(dessertTypes.sortOrder), asc(dessertTypes.name));
  return rows;
}

export async function getRecentProducts(limit = 6): Promise<ProductWithMedia[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(isNull(products.archivedAt), ne(products.availability, "HIDDEN")))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  return attachMedia(rows);
}
