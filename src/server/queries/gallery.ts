import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { categories, galleryItems } from "@/db/schema";

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
