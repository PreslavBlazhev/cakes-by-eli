import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Админ панел", template: "%s · Админ" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The admin section deliberately does not reuse the public site shell.
 * Authentication is enforced by the (panel) route group's layout, so the login
 * page can live under the same URL prefix without guarding itself.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
