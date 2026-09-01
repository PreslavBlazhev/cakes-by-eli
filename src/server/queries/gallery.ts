import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { categories, galleryItems, productImages, products } from "@/db/schema";

export type GalleryItem = typeof galleryItems.$inferSelect & {
  categoryName: string | null;
  categorySlug: string | null;
};

export async function listGallery(options?: {
  featuredOnly?: boolean;
  limit?: number;
}): Promise<GalleryItem[]> {
  const conditions = [isNull(galleryItems.archivedAt)];
  if (options?.featuredOnly) conditions.push(eq(galleryItems.isFeatured, true));

  const query = db
    .select({
      item: galleryItems,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(galleryItems)
    .leftJoin(categories, eq(galleryItems.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt));

  const rows = options?.limit ? await query.limit(options.limit) : await query;

  return rows.map((r) => ({
    ...r.item,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
  }));
}

export async function listAdminGallery(): Promise<GalleryItem[]> {
  const rows = await db
    .select({
      item: galleryItems,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(galleryItems)
    .leftJoin(categories, eq(galleryItems.categoryId, categories.id))
    .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt));

  return rows.map((r) => ({
    ...r.item,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
  }));
}

export type LibraryImage = {
  path: string;
  label: string;
  source: "gallery" | "product";
};

/**
 * Every picture already on the site, offered for reuse when a product is
 * edited. Photos are shared rather than copied: the same file can illustrate
 * a gallery entry and several products, so the owner uploads a photo once.
 *
 * Paths are unique — a picture that is both in the gallery and on a product
 * is listed once, under the gallery.
 */
export async function listImageLibrary(): Promise<LibraryImage[]> {
  const [gallery, attached] = await Promise.all([
    db
      .select({ path: galleryItems.path, caption: galleryItems.caption })
      .from(galleryItems)
      .where(isNull(galleryItems.archivedAt))
      .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt)),
    db
      .select({ path: productImages.path, name: products.name })
      .from(productImages)
      .innerJoin(products, eq(productImages.productId, products.id))
      .where(isNull(products.archivedAt))
      .orderBy(asc(products.name), asc(productImages.sortOrder)),
  ]);

  const byPath = new Map<string, LibraryImage>();

  for (const row of gallery) {
    if (byPath.has(row.path)) continue;
    byPath.set(row.path, {
      path: row.path,
      label: row.caption || "Галерия",
      source: "gallery",
    });
  }

  for (const row of attached) {
    if (byPath.has(row.path)) continue;
    byPath.set(row.path, { path: row.path, label: row.name, source: "product" });
  }

  return [...byPath.values()];
}
