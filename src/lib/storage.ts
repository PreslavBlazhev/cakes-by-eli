import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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
  /** Public URL path, e.g. `/uploads/orders/2026/ab12.jpg`. */
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

    // Resolved at runtime from configuration; the bundler must not try to
    // trace it, and this branch only runs with the local adapter.
    const baseDir = path.isAbsolute(env.STORAGE_LOCAL_DIR)
      ? env.STORAGE_LOCAL_DIR
      : path.join(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR);

    const target = path.join(baseDir, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);

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

    // Resolved at runtime from configuration; the bundler must not try to
    // trace it, and this branch only runs with the local adapter.
    const baseDir = path.isAbsolute(env.STORAGE_LOCAL_DIR)
      ? env.STORAGE_LOCAL_DIR
      : path.join(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR);

    const target = path.join(baseDir, safeKey);
    // Refuse to touch anything that escaped the storage root.
    if (!target.startsWith(baseDir)) return;

    await fs.rm(target, { force: true });
  }
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
 * Upload pipeline
 * ------------------------------------------------------------------ */

export type UploadResult =
  | { ok: true; file: StoredFile; originalName: string }
  | { ok: false; error: string; originalName: string };

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Validates and stores a single uploaded image.
 *
 * Validation is by magic bytes rather than the declared MIME type or file
 * name, and the stored name is always a fresh UUID, so a crafted filename can
 * neither traverse directories nor pick its own extension.
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const realType = sniffImageType(bytes);

  if (!realType) {
    return {
      ok: false,
      error: "Приемат се само изображения във формат JPG, PNG или WEBP.",
      originalName,
    };
  }

  const stored = await storage().save({
    bytes,
    mimeType: realType,
    folder,
    extension: EXTENSION_BY_TYPE[realType] ?? ".jpg",
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
