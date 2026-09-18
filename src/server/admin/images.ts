import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  categories,
  galleryItems,
  productImages,
  siteSettings,
} from "@/db/schema";
import { keyFromUrl, storage } from "@/lib/storage";

/**
 * Pictures are shared, not copied.
 *
 * The same file can illustrate a gallery entry, a category, several products
 * and the first screen, so a row — or a path in the settings — is only a
 * pointer. Two rules follow, and both live here so no call site can forget
 * one:
 *
 *  - a path may be attached to a product only if the site already knows it,
 *    otherwise a crafted form could point a product at any URL;
 *  - the file underneath a path may be deleted only once the last pointer to
 *    it is gone, otherwise removing one product photo blanks the gallery.
 */

/** Every image path the site itself put on disk or in `public/`. */
export async function knownImagePaths(): Promise<Set<string>> {
  const [gallery, product, category] = await Promise.all([
    db.select({ path: galleryItems.path }).from(galleryItems),
    db.select({ path: productImages.path }).from(productImages),
    db.select({ path: categories.imagePath }).from(categories),
  ]);

  const paths = new Set<string>();
  for (const row of gallery) paths.add(row.path);
  for (const row of product) paths.add(row.path);
  for (const row of category) if (row.path) paths.add(row.path);
  return paths;
}

/**
 * Deletes the file behind an image path — but only when nothing references it
 * any more. Call it *after* the row that pointed at it is gone.
 *
 * Paths outside the upload prefix (the bundled illustrations in `public/`)
 * have no storage key and are left alone.
 */
export async function removeImageFileIfUnused(path: string): Promise<void> {
  const key = keyFromUrl(path);
  if (!key) return;

  const [gallery, product, category, settings] = await Promise.all([
    db
      .select({ id: galleryItems.id })
      .from(galleryItems)
      .where(eq(galleryItems.path, path))
      .limit(1),
    db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.path, path))
      .limit(1),
    db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.imagePath, path))
      .limit(1),
    db
      .select({ heroImages: siteSettings.heroImages })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1),
  ]);

  const pinnedToHero = settings[0]?.heroImages?.includes(path) ?? false;

  if (
    gallery.length > 0 ||
    product.length > 0 ||
    category.length > 0 ||
    pinnedToHero
  ) {
    return;
  }

  await storage().remove(key);
}
