"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  econtShipments,
  orderNotes,
  orders,
  orderStatusHistory,
} from "@/db/schema";
import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { sendOrderStatusEmail } from "@/lib/email/service";
import { statusChangeEmail } from "@/lib/email/templates";
import { CUSTOMER_NOTIFIABLE_STATUSES } from "@/lib/labels";
import { orderStatusSchema, sanitizeText } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/queries/settings";
import { describeError, FAIL, OK } from "./types";
import type { ActionResult } from "./types";

const idSchema = z.uuid();

/**
 * Moves an order to a new status, records the transition and — when the owner
 * asks for it — notifies the customer. The e-mail is best-effort: a provider
 * failure is logged against the order but never rolls back the status change.
 */
export async function updateOrderStatus(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    const parsed = z
      .object({
        orderId: idSchema,
        status: orderStatusSchema,
        note: z.string().max(1000).optional().default(""),
        notifyCustomer: z.coerce.boolean().optional().default(false),
      })
      .safeParse({
        orderId: formData.get("orderId"),
        status: formData.get("status"),
        note: formData.get("note") ?? "",
        notifyCustomer: formData.get("notifyCustomer") === "on",
      });

    if (!parsed.success) return FAIL("Невалидни данни за промяна на статуса.");

    const { orderId, status, note, notifyCustomer } = parsed.data;

    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = rows[0];
    if (!order) return FAIL("Поръчката не е намерена.");

    if (order.status === status) {
      return FAIL("Поръчката вече е в този статус.");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: order.status,
        toStatus: status,
        note: sanitizeText(note),
        actor: admin.name,
      });
    });

    let emailWarning: string | null = null;

    if (notifyCustomer && CUSTOMER_NOTIFIABLE_STATUSES.includes(status)) {
      const settings = await getSettings();
      const shipments = await db
        .select({ shipmentNumber: econtShipments.shipmentNumber })
        .from(econtShipments)
        .where(eq(econtShipments.orderId, orderId))
        .limit(1);

      const email = statusChangeEmail({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status,
        businessName: settings.businessName,
        note: sanitizeText(note),
        title: snapshotTitle(readSnapshot(order.snapshot)),
        trackingNumber: shipments[0]?.shipmentNumber ?? null,
      });

      if (email) {
        const result = await sendOrderStatusEmail(orderId, {
          to: order.customerEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        if (!result.delivered) {
          emailWarning = `Статусът е записан, но известието не беше изпратено: ${result.error}`;
        }
      }
    }

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return emailWarning
      ? FAIL(emailWarning)
      : OK("Статусът на поръчката е обновен.");
  } catch (error) {
    console.error("updateOrderStatus:", error);
    return FAIL(describeError(error));
  }
}

export async function addOrderNote(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    const parsed = z
      .object({ orderId: idSchema, body: z.string().trim().min(1).max(4000) })
      .safeParse({
        orderId: formData.get("orderId"),
        body: formData.get("body"),
      });

    if (!parsed.success) return FAIL("Бележката не може да е празна.");

    await db.insert(orderNotes).values({
      orderId: parsed.data.orderId,
      body: sanitizeText(parsed.data.body),
      authorId: admin.id,
      authorName: admin.name,
    });

    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return OK("Бележката е добавена.");
  } catch (error) {
    console.error("addOrderNote:", error);
    return FAIL(describeError(error));
  }
}

/** Parcel dimensions the owner corrects before a waybill is generated. */
export async function updateShippingDetails(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = z
      .object({
        orderId: idSchema,
        shippingWeightKg: z.coerce.number().min(0.05).max(200),
        shippingLengthCm: z.coerce.number().int().min(1).max(300),
        shippingWidthCm: z.coerce.number().int().min(1).max(300),
        shippingHeightCm: z.coerce.number().int().min(1).max(300),
        packageCount: z.coerce.number().int().min(1).max(50),
        shippingDescription: z.string().trim().min(1).max(250),
        shipRecipientName: z.string().trim().max(80).optional().default(""),
        shipRecipientPhone: z.string().trim().max(24).optional().default(""),
      })
      .safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      return FAIL("Моля, проверете данните за пратката.", fieldErrors);
    }

    const { orderId, ...values } = parsed.data;

    await db
      .update(orders)
      .set({
        shippingWeightKg: values.shippingWeightKg.toFixed(2),
        shippingLengthCm: values.shippingLengthCm,
        shippingWidthCm: values.shippingWidthCm,
        shippingHeightCm: values.shippingHeightCm,
        packageCount: values.packageCount,
        shippingDescription: sanitizeText(values.shippingDescription),
        shipRecipientName: values.shipRecipientName || null,
        shipRecipientPhone: values.shipRecipientPhone || null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    revalidatePath(`/admin/orders/${orderId}`);
    return OK("Данните за пратката са запазени.");
  } catch (error) {
    console.error("updateShippingDetails:", error);
    return FAIL(describeError(error));
  }
}

/** Issues a fresh QR token, invalidating any printed label. */
export async function regenerateQrToken(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const orderId = idSchema.safeParse(formData.get("orderId"));
    if (!orderId.success) return FAIL("Невалидна поръчка.");

    const { randomBytes } = await import("node:crypto");

    await db
      .update(orders)
      .set({
        qrToken: randomBytes(24).toString("base64url"),
        qrTokenCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId.data));

    revalidatePath(`/admin/orders/${orderId.data}`);
    return OK("QR кодът е обновен. Стария разпечатан код вече не е валиден.");
  } catch (error) {
    console.error("regenerateQrToken:", error);
    return FAIL(describeError(error));
  }
}
