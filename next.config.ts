import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + its own filesystem shims; it must stay external to the
  // server bundle so Next does not try to statically analyse the wasm imports.
  // `sharp` is already in Next's own default external list, so it needs no
  // entry here even though the upload pipeline imports it directly.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: {
    // Reference images are uploaded by customers. The per-file and per-request
    // limits live in `src/lib/env.ts` (3 files × 3 MB); this stays well above
    // 9 MB so multipart overhead never turns a valid upload into an opaque
    // "body too large" error instead of the friendly Bulgarian message.
    serverActions: { bodySizeLimit: "12mb" },

    // --- Image optimizer memory budget ------------------------------------
    // The service runs on 512 MB with half a CPU, and every one of these
    // defaults is sized for a machine with neither.
    //
    // One libvips pipeline at a time. Next otherwise calls
    // `sharp.concurrency(os.cpus().length / 2)`, and inside a container
    // `os.cpus()` reports the *host's* cores, not the half core this plan
    // actually gets — measured 480 MB RSS at eight parallel optimisations
    // against 392 MB sequentially.
    imgOptConcurrency: 1,
    // libvips keeps an operation cache (50 MB / 20 files / 100 items by
    // default) that Next only touches when this is a boolean. Held native
    // memory that never comes back on a box this small.
    imgOptOperationCache: false,
    // Stream the decode rather than holding the whole raster.
    imgOptSequentialRead: true,
    // 50 MP ceiling. Uploads are downscaled to 2000 px on the way in, so
    // nothing the owner adds comes close; this only stops a decompression
    // bomb reaching libvips through a path we do not control.
    imgOptMaxInputPixels: 50_000_000,
  },
  images: {
    // WebP only. AVIF compresses ~20 % better but encodes ~12× slower —
    // measured 3 100 ms against 263 ms for the same 1200×900 source on a full
    // core. On half a core that overruns the optimizer's own 7 s timeout,
    // which means paying the memory for work that is then thrown away.
    formats: ["image/webp"],
    // 30 days. The default is 4 hours, so every image on the site was being
    // re-encoded from scratch six times a day, forever.
    minimumCacheTTL: 2_592_000,
    // Subsets of the Next defaults, so every width a browser can pick was
    // already reachable before. Dropped 750 and 1080 (within ~11 % of the
    // neighbours that remain) and 2048/3840 (above the 2000 px upload cap,
    // where they only produced a second cache key for an identical output).
    // Cuts the variant space per image from 30 to 10.
    deviceSizes: [640, 828, 1200, 1920],
    // Every `sizes` prop in the app is either a vw expression or a fixed box
    // between 48 px and 240 px; nothing asks for less than 48.
    imageSizes: [48, 64, 96, 128, 256, 384],
    // The seeded placeholder artwork is SVG. Uploads are restricted to
    // JPEG/PNG/WebP server-side, and served SVG is sandboxed with no scripting,
    // so enabling this does not widen the upload attack surface.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox; style-src 'unsafe-inline';",
  },
};

export default nextConfig;
