import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";

import { ToastProvider } from "@/components/ui/Toast";
import { env } from "@/lib/env";
import { getSettings } from "@/server/queries/settings";

import "./fonts.css";
import "./globals.css";

/**
 * Two voices, deliberately far apart.
 *
 * Playfair carries the high-contrast, printed-menu register at display
 * sizes; Manrope keeps navigation, forms and body copy plain and legible
 * at small sizes. Both ship Cyrillic, which is non-negotiable here.
 *
 * The files every page needs straight away; the rest load when text asks.
 */
const PRELOADED_FONTS = [
  "/fonts/manrope-cyrillic.woff2",
  "/fonts/manrope-latin.woff2",
  "/fonts/playfair-display-cyrillic.woff2",
  "/fonts/playfair-display-latin.woff2",
];

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings.businessName || "Cakes by ELI";

  return {
    metadataBase: new URL(env.APP_URL),
    title: {
      default: `${title} — бутикови торти и десерти в ${settings.city}`,
      template: `%s · ${title}`,
    },
    description:
      settings.metaDescription ||
      "Бутикови торти и десерти по поръчка. Създайте свой десерт с онлайн конфигуратора.",
    applicationName: title,
    openGraph: {
      type: "website",
      locale: "bg_BG",
      siteName: title,
      url: env.APP_URL,
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#241a15",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  for (const href of PRELOADED_FONTS) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }

  return (
    <html lang="bg">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[500] focus:rounded-[3px] focus:bg-ink focus:px-5 focus:py-3 focus:text-paper"
        >
          Към основното съдържание
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
