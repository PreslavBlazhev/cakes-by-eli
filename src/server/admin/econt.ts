"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { econtShipments, orders } from "@/db/schema";
import {
  EcontError,
  econtEnvironment,
  econtIsConfigured,
} from "@/lib/econt/client";
import { clearNomenclatureCache } from "@/lib/econt/nomenclatures";
import {
  calculateShipment,
  createShipment,
  getShipmentStatuses,
} from "@/lib/econt/shipments";
import type { ShipmentInput } from "@/lib/econt/shipments";
import { requireAdmin } from "@/server/auth/session";
import { describeError, FAIL, OK } from "./types";
import type { ActionResult } from "./types";

const idSchema = z.uuid();

const shipmentFormSchema = z.object({
  orderId: idSchema,
  receiverName: z.string().trim().min(2).max(80),
  receiverPhone: z.string().trim().min(6).max(24),
  receiverEmail: z.string().trim().max(160).optional().default(""),
  deliveryTo: z.enum(["office", "address"]),
  officeCode: z.string().trim().max(20).optional().default(""),
  cityId: z.coerce.number().int().positive().optional(),
  cityName: z.string().trim().max(80).optional().default(""),
  postCode: z.string().trim().max(12).optional().default(""),
  quarter: z.string().trim().max(120).optional().default(""),
  street: z.string().trim().max(120).optional().default(""),
  streetNum: z.string().trim().max(20).optional().default(""),
  other: z.string().trim().max(240).optional().default(""),
  packCount: z.coerce.number().int().min(1).max(50),
  weightKg: z.coerce.number().min(0.05).max(200),
  description: z.string().trim().min(1).max(250),
  keepUpright: z.coerce.boolean().optional().default(true),
  declaredValueEur: z.coerce.number().min(0).max(100000).optional(),
  codAmountEur: z.coerce.number().min(0).max(100000).optional(),
  confirmDuplicate: z.coerce.boolean().optional().default(false),
});

function toShipmentInput(
  values: z.infer<typeof shipmentFormSchema>,
): ShipmentInput {
  return {
    receiverName: values.receiverName,
    receiverPhone: values.receiverPhone,
    receiverEmail: values.receiverEmail || undefined,
    officeCode: values.deliveryTo === "office" ? values.officeCode : undefined,
    cityId: values.deliveryTo === "address" ? values.cityId : undefined,
    cityName: values.deliveryTo === "address" ? values.cityName : undefined,
    postCode: values.deliveryTo === "address" ? values.postCode : undefined,
    quarter: values.deliveryTo === "address" ? values.quarter : undefined,
    street: values.deliveryTo === "address" ? values.street : undefined,
    streetNum: values.deliveryTo === "address" ? values.streetNum : undefined,
    other: values.deliveryTo === "address" ? values.other : undefined,
    packCount: values.packCount,
    weightKg: values.weightKg,
    description: values.description,
    keepUpright: values.keepUpright,
    declaredValueEur: values.declaredValueEur ?? null,
    codAmountEur: values.codAmountEur ?? null,
  };
}

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return shipmentFormSchema.safeParse({
    ...raw,
    keepUpright: formData.get("keepUpright") === "on",
    confirmDuplicate: formData.get("confirmDuplicate") === "on",
    cityId: raw.cityId ? Number(raw.cityId) : undefined,
    declaredValueEur: raw.declaredValueEur ? Number(raw.declaredValueEur) : undefined,
    codAmountEur: raw.codAmountEur ? Number(raw.codAmountEur) : undefined,
  });
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] = issue.message;
  return out;
}

/** Prices the shipment through Econt without creating anything. */
export async function calculateEcontShipment(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!econtIsConfigured()) {
      return FAIL(
        "Интеграцията с Еконт не е конфигурирана (ECONT_USERNAME / ECONT_PASSWORD).",
      );
    }

    const parsed = parseForm(formData);
    if (!parsed.success) {
      return FAIL(
        "Моля, попълнете задължителните полета.",
        fieldErrorsFrom(parsed.error),
      );
    }

    const outcome = await calculateShipment(toShipmentInput(parsed.data));
    const price =
      outcome.totalPriceCents === null
        ? "неизвестна"
        : `${(outcome.totalPriceCents / 100).toFixed(2)} ${outcome.currency ?? "EUR"}`;

    return OK(`Изчислена цена на доставката: ${price}.`);
  } catch (error) {
    console.error("calculateEcontShipment:", error);
    return FAIL(econtMessage(error));
  }
}

/**
 * Issues a real waybill.
 *
 * Refuses to create a second shipment for an order that already has one unless
 * the owner explicitly confirms — a duplicate here costs real money.
 */
export async function createEcontShipment(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    if (!econtIsConfigured()) {
      return FAIL(
        "Интеграцията с Еконт не е конфигурирана (ECONT_USERNAME / ECONT_PASSWORD).",
      );
    }

    const parsed = parseForm(formData);
    if (!parsed.success) {
      return FAIL(
        "Моля, попълнете задължителните полета.",
        fieldErrorsFrom(parsed.error),
      );
    }

    const values = parsed.data;

    const existing = await db
      .select({ shipmentNumber: econtShipments.shipmentNumber })
      .from(econtShipments)
      .where(
        and(
          eq(econtShipments.orderId, values.orderId),
          isNull(econtShipments.voidedAt),
        ),
      );

    if (existing.length > 0 && !values.confirmDuplicate) {
      return FAIL(
        `За тази поръчка вече има товарителница ${existing[0].shipmentNumber}. ` +
          "Отметнете потвърждението, ако наистина искате втора.",
      );
    }

    const outcome = await createShipment(toShipmentInput(values));

    if (!outcome.shipmentNumber) {
      return FAIL(
        "Товарителницата не беше създадена — Еконт не върна номер на пратка.",
      );
    }

    await db.transaction(async (tx) => {
      await tx.insert(econtShipments).values({
        orderId: values.orderId,
        shipmentNumber: outcome.shipmentNumber!,
        pdfUrl: outcome.pdfUrl,
        totalPriceCents: outcome.totalPriceCents,
        currency: outcome.currency,
        expectedDeliveryDate: outcome.expectedDeliveryDate,
        environment: econtEnvironment(),
        requestPayload: outcome.request,
        responsePayload: outcome.response,
        createdBy: admin.id,
      });

      await tx
        .update(orders)
        .set({
          shippingWeightKg: values.weightKg.toFixed(2),
          packageCount: values.packCount,
          shippingDescription: values.description,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, values.orderId));
    });

    revalidatePath(`/admin/orders/${values.orderId}`);
    return OK(`Товарителница ${outcome.shipmentNumber} е създадена.`);
  } catch (error) {
    console.error("createEcontShipment:", error);
    // Never mark an order as shipped on failure — surface the reason instead.
    return FAIL(`Товарителницата не беше създадена. ${econtMessage(error)}`);
  }
}

export async function refreshEcontStatus(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const shipmentId = idSchema.safeParse(formData.get("shipmentId"));
    if (!shipmentId.success) return FAIL("Невалидна товарителница.");

    const rows = await db
      .select()
      .from(econtShipments)
      .where(eq(econtShipments.id, shipmentId.data))
      .limit(1);

    const shipment = rows[0];
    if (!shipment) return FAIL("Товарителницата не е намерена.");

    const statuses = await getShipmentStatuses([shipment.shipmentNumber]);
    const status = statuses[0];

    const label =
      status?.shortDeliveryStatus ??
      status?.status ??
      "Няма информация от Еконт.";

    await db
      .update(econtShipments)
      .set({ trackingStatus: label, trackingUpdatedAt: new Date() })
      .where(eq(econtShipments.id, shipment.id));

    revalidatePath(`/admin/orders/${shipment.orderId}`);
    return OK(`Статус от Еконт: ${label}`);
  } catch (error) {
    console.error("refreshEcontStatus:", error);
    return FAIL(econtMessage(error));
  }
}

/** Marks a shipment as void locally — does not cancel it at Econt. */
export async function voidEcontShipmentRecord(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const shipmentId = idSchema.safeParse(formData.get("shipmentId"));
    if (!shipmentId.success) return FAIL("Невалидна товарителница.");

    const rows = await db
      .select({ orderId: econtShipments.orderId })
      .from(econtShipments)
      .where(eq(econtShipments.id, shipmentId.data))
      .limit(1);

    if (!rows[0]) return FAIL("Товарителницата не е намерена.");

    await db
      .update(econtShipments)
      .set({ voidedAt: new Date() })
      .where(eq(econtShipments.id, shipmentId.data));

    revalidatePath(`/admin/orders/${rows[0].orderId}`);
    return OK(
      "Товарителницата е маркирана като невалидна в системата. Отказът към Еконт се прави от техния портал.",
    );
  } catch (error) {
    console.error("voidEcontShipmentRecord:", error);
    return FAIL(describeError(error));
  }
}

export async function refreshEcontNomenclatures(): Promise<ActionResult> {
  try {
    await requireAdmin();
    clearNomenclatureCache();
    return OK("Списъците с градове и офиси ще се презаредят при следващо търсене.");
  } catch (error) {
    return FAIL(describeError(error));
  }
}

function econtMessage(error: unknown): string {
  if (error instanceof EcontError) {
    return error.details.length > 0 ? error.details.join(" · ") : error.message;
  }
  return describeError(error);
}
