import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + its own filesystem shims; it must stay external to the
  // server bundle so Next does not try to statically analyse the wasm imports.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: {
    // Reference images are uploaded by customers; keep a generous but bounded body.
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // The seeded placeholder artwork is SVG. Uploads are restricted to
    // JPEG/PNG/WebP server-side, and served SVG is sandboxed with no scripting,
    // so enabling this does not widen the upload attack surface.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox; style-src 'unsafe-inline';",
  },
};

export default nextConfig;
