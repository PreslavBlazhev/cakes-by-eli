import { describe, expect, it } from "vitest";

import {
  HERO_IMAGE_SLOTS,
  isSiteImagePath,
  normalizeHeroImages,
  readHeroImagesForm,
  resolveHeroPaths,
} from "@/lib/hero-images";

/**
 * The first screen used to borrow the featured products' photographs, so the
 * same cake led the page and appeared again a screen below, with nothing in
 * the admin panel to separate them. These pin down the choice that replaced
 * it: up to three site-owned paths, and the old behaviour when none are set.
 */

describe("hero images", () => {
  it("accepts site-relative image paths only", () => {
    expect(isSiteImagePath("/uploads/products/a.webp")).toBe(true);
    expect(isSiteImagePath("/demo/gallery/photo-1.jpg")).toBe(true);

    expect(isSiteImagePath("https://example.com/cake.jpg")).toBe(false);
    expect(isSiteImagePath("//example.com/cake.jpg")).toBe(false);
    expect(isSiteImagePath("/uploads/../../etc/passwd.png")).toBe(false);
    expect(isSiteImagePath("uploads/a.webp")).toBe(false);
    expect(isSiteImagePath("/uploads/a.txt")).toBe(false);
  });

  it("drops duplicates and stops at the number of slots", () => {
    const picked = normalizeHeroImages([
      "/uploads/a.webp",
      " /uploads/a.webp ",
      "/uploads/b.webp",
      "javascript:alert(1)",
      "/uploads/c.webp",
      "/uploads/d.webp",
    ]);

    expect(picked).toEqual([
      "/uploads/a.webp",
      "/uploads/b.webp",
      "/uploads/c.webp",
    ]);
    expect(picked).toHaveLength(HERO_IMAGE_SLOTS);
  });

  it("reads the picks the admin form submits, in order", () => {
    const form = new FormData();
    form.append("heroImages", "/uploads/b.webp");
    form.append("heroImages", "/uploads/a.webp");
    form.append("heroTitle", "Добре дошли");

    expect(readHeroImagesForm(form)).toEqual([
      "/uploads/b.webp",
      "/uploads/a.webp",
    ]);
  });

  it("prefers the owner's choice over the catalogue", () => {
    const chosen = ["/uploads/pinned.webp"];
    const fallback = ["/uploads/featured-1.webp", "/uploads/featured-2.webp"];

    expect(resolveHeroPaths(chosen, fallback)).toEqual(["/uploads/pinned.webp"]);
  });

  it("falls back to the catalogue when nothing is pinned", () => {
    const fallback = [
      "/uploads/featured-1.webp",
      undefined,
      "/uploads/featured-2.webp",
      "/demo/gallery/photo-1.jpg",
      "/demo/gallery/photo-2.jpg",
    ];

    expect(resolveHeroPaths([], fallback)).toEqual([
      "/uploads/featured-1.webp",
      "/uploads/featured-2.webp",
      "/demo/gallery/photo-1.jpg",
    ]);
  });
});
