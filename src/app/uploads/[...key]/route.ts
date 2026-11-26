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

  // A view over the bytes already read, not `new Uint8Array(buffer)` — that
  // form copies, doubling every photo in memory for the life of the request.
  // `fs.readFile` always allocates a plain ArrayBuffer, never a shared one.
  const body = new Uint8Array(
    file.bytes.buffer as ArrayBuffer,
    file.bytes.byteOffset,
    file.bytes.byteLength,
  );

  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
