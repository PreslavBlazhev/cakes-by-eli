import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { listPublicCategories, listPublicProducts } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/menu`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/order`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/contacts`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const [categories, products] = await Promise.all([
      listPublicCategories(),
      listPublicProducts(),
    ]);

    return [
      ...staticRoutes,
      ...categories.map((category) => ({
        url: `${base}/menu/${category.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        lastModified: category.updatedAt,
      })),
      ...products.map((product) => ({
        url: `${base}/menu/${product.category.slug}/${product.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        lastModified: product.updatedAt,
      })),
    ];
  } catch (error) {
    // A database hiccup must not break the sitemap entirely.
    console.error("sitemap:", error);
    return staticRoutes;
  }
}
