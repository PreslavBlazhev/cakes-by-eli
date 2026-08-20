import "./_bootstrap";

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { categories, galleryItems, productImages, products } from "@/db/schema";

/**
 * Downloads placeholder photography for the demo catalogue.
 *
 * Source: Unsplash. The Unsplash License allows free use, including
 * commercially, without permission or attribution — which is why it is used
 * here rather than arbitrary images found on the web, which would be someone
 * else's copyrighted work on a real business's site.
 *
 * Photos are stored locally under public/demo so the site never depends on a
 * third-party host at runtime, and every file is recorded in
 * public/demo/CREDITS.md. All of it is demo content: the owner replaces it
 * from the admin panel with real photographs of their own work.
 *
 *   npm run demo:photos
 */

// Deliberately no browser User-Agent: Unsplash answers 401 to requests that
// impersonate a browser, and pretending to be one would be the wrong thing to
// do anyway. The default runtime agent is accepted.

type Target = {
  /** Where the file goes, relative to public/. */
  dir: string;
  /** File name without extension. */
  name: string;
  query: string;
  width: number;
  height: number;
};

const PRODUCT_QUERIES: Record<string, string> = {
  "torta-nezhen-cvyat": "elegant birthday cake",
  "torta-shokolad-i-malina": "chocolate drip cake raspberry",
  "ekleri-klasika": "eclair pastry",
  "ekleri-shamfastak": "pistachio eclair",
  "makaroni-pastel": "macarons pastel",
  "kapkeykove-rozeta": "cupcakes frosting",
  "biskviti-tematichni": "decorated sugar cookies",
  "mini-torta-serdce": "small heart cake",
  "chiyzkeyk-gorski-plodove": "cheesecake berries",
  "sladak-bar-sabitie": "dessert table sweets",
};

const CATEGORY_QUERIES: Record<string, string> = {
  torti: "layer cake",
  ekleri: "eclairs",
  kapkeykove: "cupcake",
  makaroni: "macaron",
  "dekorirani-biskviti": "iced cookies",
  "keyk-pops": "cake pops",
  "mini-torti": "mini cake",
  tartaleti: "fruit tart",
  chiyzkeykove: "cheesecake slice",
  "desertni-kutii": "sweet table dessert",
};

const GALLERY_QUERIES = [
  "wedding cake flowers",
  "chocolate cake slice",
  "pistachio eclairs",
  "colorful macarons",
  "cupcake decoration",
  "heart shaped cake",
  "gingerbread decorated cookies",
  "dessert buffet party",
];

/* ------------------------------------------------------------------ */

const usedIds = new Set<string>();
const credits: { file: string; id: string; page: string }[] = [];

/** Pulls candidate photo ids out of an Unsplash search page. */
async function searchPhotoIds(query: string): Promise<string[]> {
  const url = `https://unsplash.com/s/photos/${encodeURIComponent(
    query.replace(/\s+/g, "-"),
  )}`;

  const response = await fetch(url, { headers: { Accept: "text/html" } });

  if (!response.ok) {
    throw new Error(`Unsplash отговори с ${response.status} за „${query}“`);
  }

  const html = await response.text();
  const ids = [
    ...new Set(
      [...html.matchAll(/images\.unsplash\.com\/photo-([A-Za-z0-9_-]+)/g)].map(
        (m) => m[1],
      ),
    ),
  ];

  return ids.filter((id) => id.length > 12);
}

const JPEG = [0xff, 0xd8, 0xff];

async function download(target: Target): Promise<string | null> {
  const ids = await searchPhotoIds(target.query);
  const id = ids.find((candidate) => !usedIds.has(candidate)) ?? ids[0];

  if (!id) {
    console.warn(`  ! няма резултати за „${target.query}“`);
    return null;
  }
  usedIds.add(id);

  const src =
    `https://images.unsplash.com/photo-${id}` +
    `?fm=jpg&q=80&fit=crop&w=${target.width}&h=${target.height}`;

  const response = await fetch(src);
  if (!response.ok) {
    console.warn(`  ! свалянето се провали (${response.status}) за ${id}`);
    return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  // Never write something that is not actually a JPEG.
  if (bytes.length < 5000 || !JPEG.every((b, i) => bytes[i] === b)) {
    console.warn(`  ! ${id} не е валиден JPEG — пропуснат`);
    return null;
  }

  const dir = path.join(process.cwd(), "public", target.dir);
  fs.mkdirSync(dir, { recursive: true });

  const file = `${target.name}.jpg`;
  fs.writeFileSync(path.join(dir, file), bytes);

  const publicPath = `/${target.dir.split(path.sep).join("/")}/${file}`;
  credits.push({
    file: publicPath,
    id,
    page: `https://unsplash.com/photos/${id}`,
  });

  console.log(`  ✓ ${publicPath}  (${Math.round(bytes.length / 1024)} KB)`);
  return publicPath;
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log("\n▸ Сваляне на демо снимки от Unsplash\n");

  /* ------------------------------------------------------- Products */
  const demoProducts = await db
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products)
    .where(eq(products.isDemo, true));

  console.log(`Продукти (${demoProducts.length}):`);
  for (const product of demoProducts) {
    const query = PRODUCT_QUERIES[product.slug];
    if (!query) continue;

    const publicPath = await download({
      dir: path.join("demo", "products"),
      name: product.slug,
      query,
      width: 1200,
      height: 900,
    });
    if (!publicPath) continue;

    await db
      .delete(productImages)
      .where(eq(productImages.productId, product.id));
    await db.insert(productImages).values({
      productId: product.id,
      path: publicPath,
      alt: product.name,
      sortOrder: 0,
    });
  }

  /* ----------------------------------------------------- Categories */
  const allCategories = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);

  console.log(`\nКатегории (${allCategories.length}):`);
  for (const category of allCategories) {
    const query = CATEGORY_QUERIES[category.slug];
    if (!query) continue;

    const publicPath = await download({
      dir: path.join("demo", "categories"),
      name: category.slug,
      query,
      width: 1200,
      height: 900,
    });
    if (!publicPath) continue;

    await db
      .update(categories)
      .set({ imagePath: publicPath, updatedAt: new Date() })
      .where(eq(categories.id, category.id));
  }

  /* -------------------------------------------------------- Gallery */
  const demoGallery = await db
    .select({ id: galleryItems.id, sortOrder: galleryItems.sortOrder })
    .from(galleryItems)
    .where(eq(galleryItems.isDemo, true));

  console.log(`\nГалерия (${demoGallery.length}):`);
  for (const [index, item] of demoGallery.entries()) {
    const query = GALLERY_QUERIES[index % GALLERY_QUERIES.length];

    const publicPath = await download({
      dir: path.join("demo", "gallery"),
      name: `photo-${index + 1}`,
      query,
      width: 900,
      height: 1100,
    });
    if (!publicPath) continue;

    await db
      .update(galleryItems)
      .set({ path: publicPath, width: 900, height: 1100 })
      .where(eq(galleryItems.id, item.id));
  }

  /* -------------------------------------------------------- Credits */
  const creditsFile = path.join(process.cwd(), "public", "demo", "CREDITS.md");
  fs.writeFileSync(
    creditsFile,
    [
      "# Произход на демо снимките",
      "",
      "Всички изображения в тази папка са изтеглени от **Unsplash** и се ползват",
      "съгласно Unsplash License (свободна употреба, включително търговска, без",
      "изискване за посочване на автор).",
      "",
      "Това е **временно демо съдържание**. Заменете го с реални снимки на",
      "вашите изделия през административния панел: Продукти, Категории и Галерия.",
      "",
      "| Файл | Unsplash |",
      "| --- | --- |",
      ...credits.map((c) => `| \`${c.file}\` | ${c.page} |`),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\n✓ Готово. ${credits.length} снимки, произходът е записан в public/demo/CREDITS.md\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error("\n✗ Свалянето се провали:", error);
  process.exit(1);
});
