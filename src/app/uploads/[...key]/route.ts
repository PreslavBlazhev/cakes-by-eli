import { readLocalUpload } from "@/lib/storage";

/**
 * Serves photos uploaded after the server started.
 *
 * `next start` only knows the `public/` files that existed at boot, so without
 * this handler every new gallery or product photo stayed a blank frame until
 * the next deploy. Files that were already there at boot are still answered by
 * Next's own static handler first; this route catches the rest.
 *
 * Stored names are random UUIDs and a file is never rewritten in place, so the
 * response can be cached forever.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const file = await readLocalUpload(key);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
