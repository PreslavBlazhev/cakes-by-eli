import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The admin panel, the internal QR pages and the lookup API carry no
        // public value and some carry operational data.
        disallow: ["/admin", "/admin/", "/order-summary/", "/api/"],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
