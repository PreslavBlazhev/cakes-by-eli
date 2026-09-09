import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { env } from "@/lib/env";
import { sniffImageType } from "@/lib/validation";

/**
 * Storage abstraction for product photos, gallery images and customer
 * reference uploads.
 *
 * The local adapter is the development / small-VPS path. The S3 adapter is the
 * production recommendation; when its credentials are absent the factory says
 * so loudly instead of silently writing to a filesystem that a serverless
 * deployment would throw away.
 */

export type StoredFile = {
  /** Public URL path, e.g. `/uploads/orders/2026/ab12.webp`. */
  url: string;
  /** Storage key, used for deletion. */
  key: string;
  mimeType: string;
  sizeBytes: number;
};

export interface StorageAdapter {
  readonly name: string;
  save(input: {
    bytes: Uint8Array;
    mimeType: string;
    folder: string;
    extension: string;
  }): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Local filesystem
 * ------------------------------------------------------------------ */

class LocalStorage implements StorageAdapter {
  readonly name = "local";

  async save({
    bytes,
    mimeType,
    folder,
    extension,
  }: {
    bytes: Uint8Array;
    mimeType: string;
    folder: string;
    extension: string;
  }): Promise<StoredFile> {
    const safeFolder = sanitizeSegment(folder);
    const fileName = `${randomUUID()}${extension}`;
    const key = safeFolder ? `${safeFolder}/${fileName}` : fileName;

    const target = path.join(localBaseDir(), key);
    await fs.mkdir(path.dirname(target), { recursive: true });

    // Written under a temporary name and moved into place, so a failure
    // half-way through never leaves a truncated image behind for the site to
    // serve. `rename` is atomic within one filesystem, which is exactly the
    // scope here — both names live in the same directory.
    const staging = `${target}.${randomUUID()}.part`;
    try {
      await fs.writeFile(staging, bytes);
      await fs.rename(staging, target);
    } catch (error) {
      await fs.rm(staging, { force: true }).catch(() => {});
      throw error;
    }

    return {
      url: `${env.STORAGE_PUBLIC_PREFIX}/${key}`,
      key,
      mimeType,
      sizeBytes: bytes.byteLength,
    };
  }

  async remove(key: string): Promise<void> {
    const safeKey = key.split("/").map(sanitizeSegment).filter(Boolean).join("/");
    if (!safeKey) return;

    const baseDir = localBaseDir();
    const target = path.join(baseDir, safeKey);
    // Refuse to touch anything that escaped the storage root.
    if (!target.startsWith(baseDir)) return;

    await fs.rm(target, { force: true });
  }
}

/**
 * Resolved at runtime from configuration; the bundler must not try to trace
 * it, and it is only read on the local-adapter branch.
 */
function localBaseDir(): string {
  return path.isAbsolute(env.STORAGE_LOCAL_DIR)
    ? env.STORAGE_LOCAL_DIR
    : path.join(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR);
}

/* ------------------------------------------------------------------ *
 * S3-compatible (production)
 * ------------------------------------------------------------------ */

class S3Storage implements StorageAdapter {
  readonly name = "s3";

  async save(): Promise<StoredFile> {
    throw new Error(
      "S3 хранилището изисква инсталиране на @aws-sdk/client-s3 и попълване на " +
        "S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY " +
        "и S3_PUBLIC_BASE_URL. Виж README, раздел „Съхранение на файлове“.",
    );
  }

  async remove(): Promise<void> {
    throw new Error("S3 хранилището все още не е конфигурирано.");
  }
}

let adapter: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (adapter) return adapter;
  adapter = env.STORAGE_PROVIDER === "s3" ? new S3Storage() : new LocalStorage();
  return adapter;
}

/* ------------------------------------------------------------------ *
 * Image normalisation
 * ------------------------------------------------------------------ */

/**
 * Everything is stored as WebP, downscaled, stripped of metadata.
 *
 * The service runs on 512 MB with half a CPU, and the expensive part of
 * serving a photo is not storing it but decoding it again for every
 * `/_next/image` variant. A 24 MP phone snapshot is ~96 MB of raster on each
 * of those decodes; the same picture at 2000 px is ~16 MB. Normalising once on
 * the way in makes every later request cheap, and it is also the only place
 * that can refuse a decompression bomb before libvips ever sees it.
 */
export const MAX_INPUT_PIXELS = 50_000_000;
export const MAX_STORED_DIMENSION = 2000;
export const STORED_MIME_TYPE = "image/webp";
export const STORED_EXTENSION = ".webp";
const WEBP_QUALITY = 82;

const ACCEPTED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const UNREADABLE =
  "Файлът не може да бъде разчетен като изображение. Моля, изберете снимка във формат JPG, PNG или WEBP.";

export type NormalizedImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type NormalizeOutcome =
  | { ok: true; image: NormalizedImage }
  | { ok: false; error: string };

/**
 * Validates the header, then re-encodes.
 *
 * The pixel count is checked from the header *before* anything is decoded, so
 * an oversized image costs a header read rather than a gigabyte of raster.
 * `limitInputPixels` on the pipeline repeats the ceiling as a backstop in case
 * a header understates what the file actually contains.
 */
export async function normalizeUploadedImage(
  input: Uint8Array,
): Promise<NormalizeOutcome> {
  let width = 0;
  let height = 0;

  try {
    // Header only — `metadata()` does not decode the image, and the ceiling is
    // deliberately off here so an oversized file reaches the explicit check
    // below and gets a message that says what is wrong with it.
    const meta = await sharp(input, { limitInputPixels: false }).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return { ok: false, error: UNREADABLE };
  }

  if (width <= 0 || height <= 0) {
    return { ok: false, error: UNREADABLE };
  }

  if (width * height > MAX_INPUT_PIXELS) {
    const megapixels = (width * height) / 1_000_000;
    return {
      ok: false,
      error:
        `Снимката е прекалено голяма — ${width}×${height} пиксела ` +
        `(${megapixels.toFixed(0)} мегапиксела). Допустими са до ` +
        `${MAX_INPUT_PIXELS / 1_000_000} мегапиксела.`,
    };
  }

  try {
    const { data, info } = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    })
      // Applies the EXIF orientation and drops the tag, so a portrait photo
      // from a phone is stored upright instead of relying on every viewer to
      // honour the flag.
      .rotate()
      .resize({
        width: MAX_STORED_DIMENSION,
        height: MAX_STORED_DIMENSION,
        fit: "inside",
        // Small pictures are stored as they are; upscaling only wastes bytes.
        withoutEnlargement: true,
      })
      // sharp writes no EXIF, ICC or XMP unless asked to, so the stored file
      // carries no camera model and no GPS coordinates.
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    // `Buffer` is a `Uint8Array`; handing it over as-is avoids copying the
    // encoded image a second time.
    return {
      ok: true,
      image: { bytes: data, width: info.width, height: info.height },
    };
  } catch {
    return { ok: false, error: UNREADABLE };
  }
}

/* ------------------------------------------------------------------ *
 * Upload pipeline
 * ------------------------------------------------------------------ */

export type UploadResult =
  | { ok: true; file: StoredFile; originalName: string }
  | { ok: false; error: string; originalName: string };

/**
 * Validates, normalises and stores a single uploaded image.
 *
 * Validation is by magic bytes rather than the declared MIME type or file
 * name, and the stored name is always a fresh UUID, so a crafted filename can
 * neither traverse directories nor pick its own extension. Nothing is written
 * to disk until the re-encode has succeeded, so a rejected file leaves no
 * trace at all.
 *
 * Callers upload files one after another rather than in parallel — see
 * `src/server/orders/actions.ts` and `src/server/admin/catalog.ts`. With one
 * libvips pipeline configured in `next.config.ts` that keeps the peak cost of
 * a multi-file upload at one image, not all of them.
 */
export async function storeUploadedImage(
  file: File,
  folder: string,
): Promise<UploadResult> {
  const originalName = file.name || "изображение";
  const maxBytes = env.UPLOAD_MAX_FILE_MB * 1024 * 1024;

  if (file.size === 0) {
    return { ok: false, error: "Файлът е празен.", originalName };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `Файлът е по-голям от ${env.UPLOAD_MAX_FILE_MB} MB.`,
      originalName,
    };
  }

  // `bytes` is the whole upload in memory; it is dropped the moment the
  // re-encoded copy exists so the two never sit side by side longer than the
  // encode itself.
  let bytes: Uint8Array | null = new Uint8Array(await file.arrayBuffer());

  if (!ACCEPTED_INPUT_TYPES.has(sniffImageType(bytes) ?? "")) {
    bytes = null;
    return {
      ok: false,
      error: "Приемат се само изображения във формат JPG, PNG или WEBP.",
      originalName,
    };
  }

  const normalized = await normalizeUploadedImage(bytes);
  bytes = null;

  if (!normalized.ok) {
    return { ok: false, error: normalized.error, originalName };
  }

  // The encoded copy is handed straight to the adapter and nothing keeps a
  // reference to it afterwards — the result carries only metadata, so the
  // buffer becomes collectable as soon as this function returns.
  const stored = await storage().save({
    bytes: normalized.image.bytes,
    mimeType: STORED_MIME_TYPE,
    folder,
    extension: STORED_EXTENSION,
  });

  return { ok: true, file: stored, originalName };
}

/** Turns a public URL back into the storage key used to delete it. */
export function keyFromUrl(url: string): string {
  const prefix = env.STORAGE_PUBLIC_PREFIX.endsWith("/")
    ? env.STORAGE_PUBLIC_PREFIX
    : `${env.STORAGE_PUBLIC_PREFIX}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : "";
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "").replace(/^\.+/, "");
}
