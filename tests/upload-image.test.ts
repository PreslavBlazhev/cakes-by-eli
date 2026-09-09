import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/**
 * The upload pipeline is what keeps the image optimizer affordable.
 *
 * Photos used to be stored exactly as they arrived, which meant every
 * `/_next/image` variant decoded the original again — a 24 MP phone snapshot is
 * ~96 MB of raster per decode on a 512 MB service. Normalising once on the way
 * in is the fix, so these tests pin down what "normalised" means: WebP, at most
 * 2000 px, EXIF orientation applied, metadata gone, and nothing at all written
 * to disk when the input is rejected.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), "cbe-upload-"));
const uploadDir = path.join(root, "uploads");

process.env.DATABASE_URL = "";
process.env.PGLITE_DIR = path.join(root, "pglite");
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = uploadDir;
process.env.STORAGE_PUBLIC_PREFIX = "/uploads";
process.env.APP_URL = "http://localhost:3000";
process.env.UPLOAD_MAX_FILE_MB = "3";
process.env.UPLOAD_MAX_FILES = "3";

const storageModule = await import("@/lib/storage");
const {
  storeUploadedImage,
  normalizeUploadedImage,
  MAX_INPUT_PIXELS,
  MAX_STORED_DIMENSION,
  STORED_MIME_TYPE,
  STORED_EXTENSION,
} = storageModule;

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  fs.mkdirSync(uploadDir, { recursive: true });
});

/** Every file below the upload root, including any leftover staging file. */
function filesOnDisk(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(uploadDir);
  return out;
}

function asFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** A solid-colour source in the requested format and size. */
async function source(
  format: "jpeg" | "png" | "webp",
  width: number,
  height: number,
): Promise<Buffer> {
  const base = sharp({
    create: { width, height, channels: 3, background: "#c86b8a" },
  });
  if (format === "jpeg") return base.jpeg({ quality: 90 }).toBuffer();
  if (format === "png") return base.png().toBuffer();
  return base.webp({ quality: 90 }).toBuffer();
}

describe("accepted input formats", () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    it(`accepts ${format.toUpperCase()} and stores it as WebP`, async () => {
      const bytes = await source(format, 900, 600);
      const result = await storeUploadedImage(
        asFile(bytes, `снимка.${format}`, `image/${format}`),
        "products",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.file.mimeType).toBe(STORED_MIME_TYPE);
      expect(result.file.url.endsWith(STORED_EXTENSION)).toBe(true);
      expect(result.file.key.endsWith(STORED_EXTENSION)).toBe(true);
      expect(result.file.url.startsWith("/uploads/products/")).toBe(true);

      const written = filesOnDisk();
      expect(written).toHaveLength(1);

      const onDisk = fs.readFileSync(written[0]);
      // The recorded size must describe the file that was actually written,
      // not the upload it came from.
      expect(result.file.sizeBytes).toBe(onDisk.byteLength);

      const meta = await sharp(onDisk).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(900);
      expect(meta.height).toBe(600);
    });
  }

  it("rejects a file whose bytes are not an allowed image, whatever it claims", async () => {
    const gif = Buffer.from("GIF89a" + "x".repeat(64), "latin1");
    const result = await storeUploadedImage(
      asFile(gif, "trojan.jpg", "image/jpeg"),
      "products",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("JPG, PNG или WEBP");
    expect(filesOnDisk()).toHaveLength(0);
  });
});

describe("downscaling", () => {
  it("caps the long side at 2000 px and keeps the aspect ratio", async () => {
    const bytes = await source("jpeg", 3000, 1500);
    const result = await storeUploadedImage(
      asFile(bytes, "широка.jpg", "image/jpeg"),
      "gallery",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const meta = await sharp(fs.readFileSync(filesOnDisk()[0])).metadata();
    expect(meta.width).toBe(MAX_STORED_DIMENSION);
    expect(meta.height).toBe(MAX_STORED_DIMENSION / 2);
  });

  it("caps a portrait image on its long side too", async () => {
    const bytes = await source("jpeg", 1200, 2400);
    const result = await normalizeUploadedImage(bytes);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.height).toBe(MAX_STORED_DIMENSION);
    expect(result.image.width).toBe(MAX_STORED_DIMENSION / 2);
  });

  it("never enlarges a small image", async () => {
    const bytes = await source("png", 320, 240);
    const result = await normalizeUploadedImage(bytes);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.width).toBe(320);
    expect(result.image.height).toBe(240);
  });
});

describe("EXIF", () => {
  it("applies the orientation flag instead of trusting the viewer", async () => {
    // Orientation 6 means "rotate 90° clockwise": a 100×40 frame is really a
    // 40×100 picture. Storing it without applying that leaves every browser to
    // guess, and a stripped-metadata copy loses the flag entirely.
    const rotated = await sharp({
      create: { width: 100, height: 40, channels: 3, background: "#123456" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    expect((await sharp(rotated).metadata()).orientation).toBe(6);

    const result = await normalizeUploadedImage(rotated);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.image.width).toBe(40);
    expect(result.image.height).toBe(100);

    const meta = await sharp(result.image.bytes).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(100);
    // Nothing left to re-interpret, and no camera or GPS data carried through.
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });
});

describe("rejected input", () => {
  it("refuses an image with too many pixels, before decoding it", async () => {
    // 9000 × 7000 is 63 MP — a small file that would expand to ~250 MB of
    // raster. The header check is what stops it.
    const bomb = await sharp({
      create: { width: 9000, height: 7000, channels: 3, background: "#ffffff" },
    })
      .jpeg({ quality: 40 })
      .toBuffer();

    expect(bomb.byteLength).toBeLessThan(3 * 1024 * 1024);

    const result = await storeUploadedImage(
      asFile(bomb, "бомба.jpg", "image/jpeg"),
      "orders",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("прекалено голяма");
    expect(result.error).toContain("9000×7000");
    expect(result.error).toContain(String(MAX_INPUT_PIXELS / 1_000_000));
    expect(filesOnDisk()).toHaveLength(0);
  });

  it("refuses a corrupt image with a readable Bulgarian message", async () => {
    // Valid JPEG magic bytes, garbage after them: passes the sniffer, fails the
    // decode. Exactly the case that must not reach the filesystem.
    const corrupt = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(4096, 0x41),
    ]);

    const result = await storeUploadedImage(
      asFile(corrupt, "счупена.jpg", "image/jpeg"),
      "orders",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("не може да бъде разчетен");
    expect(filesOnDisk()).toHaveLength(0);
  });

  it("leaves nothing behind — not even a staging file — for any rejection", async () => {
    const cases: Uint8Array[] = [
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]),
      Buffer.from("GIF89a" + "x".repeat(64), "latin1"),
      await sharp({
        create: { width: 9000, height: 7000, channels: 3, background: "#000" },
      })
        .jpeg({ quality: 30 })
        .toBuffer(),
    ];

    for (const bytes of cases) {
      const result = await storeUploadedImage(
        asFile(bytes, "отказана.jpg", "image/jpeg"),
        "orders",
      );
      expect(result.ok).toBe(false);
    }

    expect(filesOnDisk()).toHaveLength(0);
    // A `.part` file would mean a half-written image could be served.
    expect(filesOnDisk().filter((f) => f.endsWith(".part"))).toHaveLength(0);
  });

  it("refuses an empty file and one over the size limit", async () => {
    const empty = await storeUploadedImage(
      asFile(new Uint8Array(0), "празна.jpg", "image/jpeg"),
      "orders",
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("празен");

    const tooBig = new Uint8Array(4 * 1024 * 1024);
    tooBig.set([0xff, 0xd8, 0xff]);
    const oversized = await storeUploadedImage(
      asFile(tooBig, "голяма.jpg", "image/jpeg"),
      "orders",
    );
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.error).toContain("3 MB");

    expect(filesOnDisk()).toHaveLength(0);
  });
});

describe("path traversal", () => {
  it("ignores a crafted folder name and always names the file itself", async () => {
    const bytes = await source("jpeg", 200, 200);
    const result = await storeUploadedImage(
      asFile(bytes, "../../../etc/passwd.jpg", "image/jpeg"),
      "../../escape",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The folder is stripped to safe characters and the name is a fresh UUID,
    // so neither half of the input can steer where the bytes land.
    expect(result.file.key).not.toContain("..");
    expect(result.file.key).not.toContain("passwd");
    expect(result.file.key).toMatch(
      /^escape\/[0-9a-f-]{36}\.webp$/,
    );

    const written = filesOnDisk();
    expect(written).toHaveLength(1);
    expect(path.resolve(written[0]).startsWith(path.resolve(uploadDir))).toBe(
      true,
    );
  });
});
