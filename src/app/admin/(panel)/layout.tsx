import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

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

  void pruneSessions();

  const newOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.status, "NEW"));

  return (
    <>
      <AdminChrome />
      <AdminShell
        adminName={admin.name}
        newOrderCount={newOrders.length}
        configWarnings={configurationWarnings()}
      >
        {children}
      </AdminShell>
    </>
  );
}
