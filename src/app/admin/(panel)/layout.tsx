import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";

import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { configurationWarnings } from "@/lib/env";
import { currentAdmin, pruneSessions } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * Every route beneath this layout is authenticated. The check happens on the
 * server before any privileged data is read, and each server action repeats it
 * independently — hiding the UI is not authorisation.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  // `pruneSessions` swallows its own failures, but the `.catch()` is what makes
  // that a property of this call site rather than a promise anyone could break
  // later: an unhandled rejection here would take the whole process down.
  void pruneSessions().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        tag: "SESSION_PRUNE_FAILED",
        message: error instanceof Error ? error.message : "неизвестна грешка",
      }),
    );
  });

  // Counted in SQL. This used to select every NEW order just to read
  // `.length` for the sidebar badge, on every admin page view.
  const newOrders = await db
    .select({ total: count() })
    .from(orders)
    .where(eq(orders.status, "NEW"));

  return (
    <>
      <AdminChrome />
      <AdminShell
        adminName={admin.name}
        newOrderCount={newOrders[0]?.total ?? 0}
        configWarnings={configurationWarnings()}
      >
        {children}
      </AdminShell>
    </>
  );
}
