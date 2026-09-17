/**
 * Browser-side downscale of photos before they are uploaded.
 *
 * A phone photo is routinely 4–8 MB, above the server's per-file limit and —
 * a few at a time — above the server-action body limit, where Next rejects the
 * whole request before our friendly messages can run. The server re-encodes
 * everything to at most 2000 px anyway, so doing the same resize here loses
 * nothing and turns a 6 MB upload into a few hundred KB.
 *
 * Anything this cannot decode (an unusual format, an old browser) is passed
 * through untouched; the server still validates and explains the problem.
 */

/** Same ceiling the server stores at — see `MAX_STORED_DIMENSION`. */
export const CLIENT_MAX_DIMENSION = 2000;

/** Files at or under this size and dimension are sent as they are. */
const PASS_THROUGH_BYTES = 1.2 * 1024 * 1024;

const JPEG_QUALITY = 0.88;

const SHRINKABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function shrinkImageFile(file: File): Promise<File> {
  if (!SHRINKABLE.has(file.type)) return file;
  if (typeof document === "undefined") return file;

  let source: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    try {
      source = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      objectUrl = URL.createObjectURL(file);
      source = await loadImage(objectUrl);
    }

    const width = source.width;
    const height = source.height;
    if (!width || !height) return file;

    const longest = Math.max(width, height);
    if (file.size <= PASS_THROUGH_BYTES && longest <= CLIENT_MAX_DIMENSION) {
      return file;
    }

    const scale = Math.min(1, CLIENT_MAX_DIMENSION / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) return file;

    // PNGs can be transparent; JPEG has no alpha, so paint white underneath
    // instead of letting transparent areas turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    canvas.width = 0;
    canvas.height = 0;

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "snimka";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    if (source && "close" in source) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Shrinks every non-empty file in a form, leaving all other fields alone. */
export async function shrinkFormImages(formData: FormData): Promise<FormData> {
  const out = new FormData();
  for (const [name, value] of formData.entries()) {
    if (value instanceof File && value.size > 0) {
      out.append(name, await shrinkImageFile(value));
    } else {
      out.append(name, value);
    }
  }
  return out;
}

/** Total bytes of the files in a form. */
export function formFileBytes(formData: FormData): number {
  let total = 0;
  for (const value of formData.values()) {
    if (value instanceof File) total += value.size;
  }
  return total;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = src;
  });
}
