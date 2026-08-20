import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { ToastProvider } from "@/components/ui/Toast";
import { env } from "@/lib/env";
import { getSettings } from "@/server/queries/settings";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const display = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

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
  themeColor: "#2f211d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg" className={`${inter.variable} ${display.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[500] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-paper"
        >
          Към основното съдържание
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
