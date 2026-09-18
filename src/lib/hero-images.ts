/**
 * The photographs in the first screen's collage.
 *
 * They used to be taken from the featured products, so the same three cakes
 * led the page and then appeared again, unchanged, in the „Избрано“ section a
 * screen below — and the owner had no way to break the pair apart. The choice
 * is now hers: `site_settings.hero_images` holds up to three paths, picked in
 * Админ → Текстове на сайта → „1. Първи екран“.
 *
 * An empty list keeps the old behaviour, so a site that has never been
 * configured still leads with a photograph rather than a grey box.
 */

/** Lead plate, inset plate, accent plate — the collage has exactly three. */
export const HERO_IMAGE_SLOTS = 3;

/**
 * Site-relative image paths only: `/uploads/...` for what the owner uploaded,
 * `/demo/...` for the bundled illustrations. A full URL is refused, so a
 * hand-edited form cannot point the first screen at someone else's server.
 * The save action additionally checks that the site knows the path.
 */
export function isSiteImagePath(value: string): boolean {
  return /^\/[A-Za-z0-9._\-/]+\.(jpe?g|png|webp|avif|gif|svg)$/i.test(value)
    && !value.includes("..")
    && !value.startsWith("//");
}

/** Cleans a list of picks: trimmed, path-checked, deduplicated, capped. */
export function normalizeHeroImages(values: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const entry of values) {
    const path = String(entry ?? "").trim();
    if (!path || !isSiteImagePath(path) || out.includes(path)) continue;
    out.push(path);
    if (out.length === HERO_IMAGE_SLOTS) break;
  }
  return out;
}

/** The picks as the admin form submits them — one hidden input per photo. */
export function readHeroImagesForm(formData: FormData): string[] {
  return normalizeHeroImages(formData.getAll("heroImages"));
}

/**
 * Which photographs the collage shows: the owner's choice, and only when she
 * has made none, the ones the catalogue can offer.
 */
export function resolveHeroPaths(
  chosen: readonly unknown[],
  fallback: readonly (string | undefined | null)[],
): string[] {
  const picked = normalizeHeroImages(chosen);
  if (picked.length > 0) return picked;
  return normalizeHeroImages(fallback.filter(Boolean));
}
