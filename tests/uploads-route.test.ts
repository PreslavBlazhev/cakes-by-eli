import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * `next start` indexes `public/` once at boot, so a photo uploaded afterwards
 * was a 404 — an empty frame in the gallery — until the next restart. The
 * `/uploads/[...key]` route reads the storage directory directly; these check
 * that it finds new files and refuses everything outside that directory.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), "cbe-serve-"));
const uploadDir = path.join(root, "uploads");
fs.mkdirSync(path.join(uploadDir, "gallery"), { recursive: true });
fs.writeFileSync(path.join(uploadDir, "gallery", "abc.webp"), "WEBP");
fs.writeFileSync(path.join(uploadDir, "gallery", "abc.webp.1.part"), "partial");
fs.writeFileSync(path.join(root, "secret.webp"), "outside");
// Larger than Node's 8 KB buffer pool, with every byte value, so a body that
// pointed at the wrong slice of a shared ArrayBuffer could not pass.
const photo = Buffer.alloc(300_000);
for (let i = 0; i < photo.length; i += 1) photo[i] = (i * 31 + 7) % 256;
fs.writeFileSync(path.join(uploadDir, "gallery", "photo.jpg"), photo);

process.env.DATABASE_URL = "";
process.env.PGLITE_DIR = path.join(root, "pglite");
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = uploadDir;
process.env.STORAGE_PUBLIC_PREFIX = "/uploads";

const { GET } = await import("@/app/uploads/[...key]/route");

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const get = (key: string[]) =>
  GET(new Request("http://localhost/uploads/x"), {
    params: Promise.resolve({ key }),
  });

describe("GET /uploads/[...key]", () => {
  it("serves a file written after the server started", async () => {
    const response = await get(["gallery", "abc.webp"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(await response.text()).toBe("WEBP");
  });

  it("returns the stored bytes exactly, with a matching length", async () => {
    const response = await get(["gallery", "photo.jpg"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-length")).toBe(String(photo.length));
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(photo)).toBe(true);
  });

  it("returns 404 for a missing file", async () => {
    expect((await get(["gallery", "missing.webp"])).status).toBe(404);
  });

  it.each([
    [["..", "secret.webp"]],
    [["gallery", "..", "..", "secret.webp"]],
    [["gallery", "abc.webp.1.part"]],
    [[".hidden.webp"]],
    [[]],
  ])("refuses %j", async (key) => {
    expect((await get(key)).status).toBe(404);
  });
});
