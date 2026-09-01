import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Pictures are shared, not copied: one file can illustrate a gallery entry and
 * several products at once. Two rules keep that safe, and both are exercised
 * here against a real PostgreSQL (a throwaway PGlite from the same migrations)
 * and a real temporary storage directory:
 *
 *  - a product may only be pointed at a path the site already knows;
 *  - a file is deleted only when the last row referencing it is gone.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), "cbe-images-"));
const uploadDir = path.join(root, "uploads");

process.env.PGLITE_DIR = path.join(root, "pglite");
process.env.DATABASE_URL = "";
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = uploadDir;
process.env.STORAGE_PUBLIC_PREFIX = "/uploads";
process.env.APP_URL = "http://localhost:3000";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/session", () => ({
  requireAdmin: async () => ({ id: "test-admin", email: "admin@example.com" }),
}));

type Db = Awaited<typeof import("@/db/client")>["db"];
type Schema = typeof import("@/db/schema");
type Catalog = typeof import("@/server/admin/catalog");
type Images = typeof import("@/server/admin/images");

let db: Db;
let schema: Schema;
let catalog: Catalog;
let images: Images;
let eq: typeof import("drizzle-orm")["eq"];
let asc: typeof import("drizzle-orm")["asc"];

let categoryId = "";
let productId = "";

/** The form the admin panel submits, with only the fields the action needs. */
function productForm(fields: Record<string, string>, libraryPaths: string[] = []) {
  const formData = new FormData();
  formData.set("categoryId", categoryId);
  formData.set("availability", "ACTIVE");
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  for (const path of libraryPaths) formData.append("libraryPaths", path);
  return formData;
}

async function imagePathsOf(id: string): Promise<string[]> {
  const rows = await db
    .select({ path: schema.productImages.path })
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, id))
    .orderBy(asc(schema.productImages.sortOrder));
  return rows.map((row) => row.path);
}

/** Writes a file into the storage root the way an upload would. */
function writeStoredFile(publicPath: string) {
  const target = path.join(uploadDir, publicPath.replace(/^\/uploads\//, ""));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "not-really-a-jpeg");
  return target;
}

beforeAll(async () => {
  const client = await import("@/db/client");
  db = client.db;
  schema = await import("@/db/schema");
  ({ eq, asc } = await import("drizzle-orm"));

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  catalog = await import("@/server/admin/catalog");
  images = await import("@/server/admin/images");

  const [category] = await db
    .insert(schema.categories)
    .values({ slug: "torti", name: "Торти" })
    .returning({ id: schema.categories.id });
  categoryId = category.id;

  const [product] = await db
    .insert(schema.products)
    .values({ categoryId, slug: "torta-test", name: "Торта за тест" })
    .returning({ id: schema.products.id });
  productId = product.id;
}, 120_000);

afterAll(() => {
  // PGlite may still hold file handles on Windows; a leftover temp directory
  // must never fail the suite.
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("picking a picture out of the site's own images", () => {
  const galleryPath = "/uploads/gallery/known.jpg";

  it("attaches a picture the site already knows", async () => {
    await db
      .insert(schema.galleryItems)
      .values({ path: galleryPath, caption: "Позната снимка" });

    const result = await catalog.saveProduct(
      productForm({ id: productId, name: "Торта за тест" }, [galleryPath]),
    );

    expect(result.ok).toBe(true);
    expect(await imagePathsOf(productId)).toEqual([galleryPath]);
  });

  it("refuses a path the site has never stored", async () => {
    const result = await catalog.saveProduct(
      productForm({ id: productId, name: "Торта за тест" }, [
        "/uploads/../../etc/passwd",
      ]),
    );

    expect(result.ok).toBe(false);
    expect(await imagePathsOf(productId)).toEqual([galleryPath]);
  });

  it("does not attach the same picture twice", async () => {
    const result = await catalog.saveProduct(
      productForm({ id: productId, name: "Торта за тест" }, [galleryPath]),
    );

    expect(result.ok).toBe(true);
    expect(await imagePathsOf(productId)).toEqual([galleryPath]);
  });
});

describe("choosing the cover", () => {
  const second = "/uploads/gallery/second.jpg";
  const third = "/uploads/gallery/third.jpg";

  it("moves the chosen picture to the front and renumbers the rest", async () => {
    await db.insert(schema.galleryItems).values([
      { path: second, caption: "Втора" },
      { path: third, caption: "Трета" },
    ]);

    await catalog.saveProduct(
      productForm({ id: productId, name: "Торта за тест" }, [second, third]),
    );

    const before = await imagePathsOf(productId);
    expect(before).toEqual(["/uploads/gallery/known.jpg", second, third]);

    const [target] = await db
      .select({ id: schema.productImages.id })
      .from(schema.productImages)
      .where(eq(schema.productImages.path, third));

    const result = await catalog.setProductCoverImage(
      formDataWith({ imageId: target.id }),
    );

    expect(result.ok).toBe(true);
    expect(await imagePathsOf(productId)).toEqual([
      third,
      "/uploads/gallery/known.jpg",
      second,
    ]);

    const orders = await db
      .select({ sortOrder: schema.productImages.sortOrder })
      .from(schema.productImages)
      .where(eq(schema.productImages.productId, productId))
      .orderBy(asc(schema.productImages.sortOrder));
    expect(orders.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("deleting the file under a picture", () => {
  it("keeps a file the gallery is still showing", async () => {
    const shared = "/uploads/products/shared.jpg";
    const file = writeStoredFile(shared);

    await db.insert(schema.galleryItems).values({ path: shared, caption: "Обща" });
    const [row] = await db
      .insert(schema.productImages)
      .values({ productId, path: shared, sortOrder: 90 })
      .returning({ id: schema.productImages.id });

    const result = await catalog.deleteProductImage(
      formDataWith({ imageId: row.id }),
    );

    expect(result.ok).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("removes a file once the last row pointing at it is gone", async () => {
    const lonely = "/uploads/products/lonely.jpg";
    const file = writeStoredFile(lonely);

    const [row] = await db
      .insert(schema.productImages)
      .values({ productId, path: lonely, sortOrder: 91 })
      .returning({ id: schema.productImages.id });

    const result = await catalog.deleteProductImage(
      formDataWith({ imageId: row.id }),
    );

    expect(result.ok).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("leaves the bundled illustrations in public/ alone", async () => {
    // Nothing outside the upload prefix has a storage key to delete.
    await expect(
      images.removeImageFileIfUnused("/demo/gallery/photo-1.jpg"),
    ).resolves.toBeUndefined();
  });
});

function formDataWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}
