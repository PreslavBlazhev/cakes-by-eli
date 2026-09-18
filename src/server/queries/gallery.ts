import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { categories, galleryItems, productImages, products } from "@/db/schema";
import {
  MAX_GALLERY_ROWS,
  MAX_LIBRARY_ROWS,
  warnIfTruncated,
} from "./ceiling";

export { MAX_GALLERY_ROWS, MAX_LIBRARY_ROWS };

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

  const rows = await query.limit(
    Math.min(options?.limit ?? MAX_GALLERY_ROWS, MAX_GALLERY_ROWS),
  );
  if (!options?.limit) warnIfTruncated("listGallery", rows, MAX_GALLERY_ROWS);

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
    .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt))
    .limit(MAX_GALLERY_ROWS);
  warnIfTruncated("listAdminGallery", rows, MAX_GALLERY_ROWS);

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
      .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt))
      .limit(MAX_LIBRARY_ROWS),
    db
      .select({ path: productImages.path, name: products.name })
      .from(productImages)
      .innerJoin(products, eq(productImages.productId, products.id))
      .where(isNull(products.archivedAt))
      .orderBy(asc(products.name), asc(productImages.sortOrder))
      .limit(MAX_LIBRARY_ROWS),
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

  // Each query above is capped separately, so their union can be twice the
  // ceiling — the final slice is what actually makes the promise hold.
  const images = [...byPath.values()].slice(0, MAX_LIBRARY_ROWS);
  warnIfTruncated("listImageLibrary", images, MAX_LIBRARY_ROWS);
  return images;
}

/**
 * Alt text for pictures addressed by path alone — the ones the owner pinned
 * to the first screen. Only the paths asked for are read, so a home page that
 * shows three photographs runs two small lookups, not a library listing.
 */
export async function describeImagePaths(
  paths: readonly string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths)].filter(Boolean);
  if (wanted.length === 0) return new Map();

  const [gallery, attached] = await Promise.all([
    db
      .select({ path: galleryItems.path, caption: galleryItems.caption })
      .from(galleryItems)
      .where(inArray(galleryItems.path, wanted)),
    db
      .select({ path: productImages.path, alt: productImages.alt, name: products.name })
      .from(productImages)
      .innerJoin(products, eq(productImages.productId, products.id))
      .where(inArray(productImages.path, wanted)),
  ]);

  const labels = new Map<string, string>();
  for (const row of attached) {
    if (!labels.has(row.path)) labels.set(row.path, row.alt || row.name);
  }
  // A caption describes the picture itself, so it wins over a product name.
  for (const row of gallery) {
    if (row.caption) labels.set(row.path, row.caption);
    else if (!labels.has(row.path)) labels.set(row.path, "");
  }
  return labels;
}
