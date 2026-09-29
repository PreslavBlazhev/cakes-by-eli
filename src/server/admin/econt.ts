"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { econtShipments, orders } from "@/db/schema";
import { EcontError, econtEnvironment } from "@/lib/econt/client";
import { clearNomenclatureCache } from "@/lib/econt/nomenclatures";
import { econtReadiness } from "@/lib/econt/readiness";
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
  /**
   * No default on purpose: the owner decides per order whether the customer
   * already paid for the dessert or pays it to the courier.
   */
  paymentMode: z.enum(["cod", "prepaid"], {
    message: "Изберете дали има наложен платеж.",
  }),
  codAmountEur: z.coerce.number().min(0).max(100000).optional(),
  codConfirmed: z.coerce.boolean().optional().default(false),
  confirmDuplicate: z.coerce.boolean().optional().default(false),
  /** How many active waybills the owner saw when the form was opened. */
  knownShipments: z.coerce.number().int().min(0).default(0),
}).superRefine((values, ctx) => {
  if (values.deliveryTo === "office" && !values.officeCode) {
    ctx.addIssue({ code: "custom", path: ["officeCode"], message: "Въведете код на офис." });
  }
  if (values.deliveryTo === "address") {
    if (!values.cityId) {
      ctx.addIssue({ code: "custom", path: ["cityId"], message: "Изберете населено място от номенклатурата." });
    }
    if (!values.street && !values.quarter) {
      ctx.addIssue({ code: "custom", path: ["street"], message: "Въведете улица или квартал." });
    }
  }
  if (values.paymentMode === "cod" && !(values.codAmountEur && values.codAmountEur > 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["codAmountEur"],
      message: "Въведете точната сума на наложения платеж.",
    });
  }
});

type ShipmentForm = z.infer<typeof shipmentFormSchema>;

/** Cash on delivery the form asks for, in EUR, or null for a prepaid order. */
function codAmountOf(values: ShipmentForm): number | null {
  return values.paymentMode === "cod" && values.codAmountEur
    ? Math.round(values.codAmountEur * 100) / 100
    : null;
}

/**
 * Orders with a waybill being issued right now. The site runs as a single
 * Node process, so this is enough to turn a double click or two open tabs
 * into one Econt request instead of two paid shipments.
 */
const creating = new Set<string>();

async function econtOrder(orderId: string) {
  const rows = await db
    .select({ fulfillmentMethod: orders.fulfillmentMethod })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

function toShipmentInput(values: ShipmentForm): ShipmentInput {
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
    codAmountEur: codAmountOf(values),
  };
}

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return shipmentFormSchema.safeParse({
    ...raw,
    paymentMode: raw.paymentMode || undefined,
    keepUpright: formData.get("keepUpright") === "on",
    codConfirmed: formData.get("codConfirmed") === "on",
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

export type EcontQuote = {
  totalPriceCents: number | null;
  senderDueCents: number | null;
  receiverDueCents: number | null;
  codAmountCents: number | null;
  currency: string;
  expectedDeliveryDate: string | null;
  services: { description: string; price: number; currency: string }[];
};

export type QuoteResult =
  | { ok: true; message: string; quote: EcontQuote }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Common gatekeeping for both calculating and creating. */
async function prepare(
  formData: FormData,
): Promise<
  | { ok: true; values: ShipmentForm }
  | { ok: false; result: Extract<ActionResult, { ok: false }> }
> {
  const readiness = await econtReadiness();
  if (!readiness.ready) {
    return { ok: false, result: FAIL(readiness.problems.join(" ")) };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      result: FAIL(
        "Моля, попълнете задължителните полета.",
        fieldErrorsFrom(parsed.error),
      ),
    };
  }

  const order = await econtOrder(parsed.data.orderId);
  if (!order) {
    return { ok: false, result: FAIL("Поръчката не е намерена.") };
  }
  if (order.fulfillmentMethod === "PICKUP") {
    return {
      ok: false,
      result: FAIL(
        "Тази поръчка е за вземане от сладкарницата — товарителница не се създава.",
      ),
    };
  }

  return { ok: true, values: parsed.data };
}

/** Prices the shipment through Econt without creating anything. */
export async function calculateEcontShipment(
  formData: FormData,
): Promise<QuoteResult> {
  try {
    await requireAdmin();

    const prepared = await prepare(formData);
    if (!prepared.ok) return prepared.result;

    const outcome = await calculateShipment(toShipmentInput(prepared.values));
    const cod = codAmountOf(prepared.values);

    return {
      ok: true,
      message: "Цената е изчислена от Еконт. Прегледайте я преди създаване.",
      quote: {
        totalPriceCents: outcome.totalPriceCents,
        senderDueCents: outcome.senderDueCents,
        receiverDueCents: outcome.receiverDueCents,
        codAmountCents: cod === null ? null : Math.round(cod * 100),
        currency: outcome.currency ?? "EUR",
        expectedDeliveryDate: outcome.expectedDeliveryDate?.toISOString() ?? null,
        services: outcome.services,
      },
    };
  } catch (error) {
    console.error("calculateEcontShipment:", error);
    return FAIL(econtMessage(error));
  }
}

/**
 * Issues a real waybill.
 *
 * The customer pays for delivery. Cash on delivery is only added when the
 * owner chose it and confirmed the exact amount. A second shipment for the
 * same order needs an explicit confirmation, and concurrent submissions for
 * one order are refused — a duplicate here costs real money.
 */
export async function createEcontShipment(
  formData: FormData,
): Promise<ActionResult> {
  let lockedOrderId: string | null = null;
  try {
    const admin = await requireAdmin();

    const prepared = await prepare(formData);
    if (!prepared.ok) return prepared.result;
    const values = prepared.values;

    if (values.paymentMode === "cod" && !values.codConfirmed) {
      return FAIL("Потвърдете точната сума на наложения платеж.", {
        codConfirmed: "Потвърдете сумата.",
      });
    }

    if (creating.has(values.orderId)) {
      return FAIL(
        "За тази поръчка вече се създава товарителница. Изчакайте резултата.",
      );
    }
    creating.add(values.orderId);
    lockedOrderId = values.orderId;

    const existing = await db
      .select({ shipmentNumber: econtShipments.shipmentNumber })
      .from(econtShipments)
      .where(
        and(
          eq(econtShipments.orderId, values.orderId),
          isNull(econtShipments.voidedAt),
        ),
      );

    // A confirmation covers exactly the waybills the owner saw. Anything
    // created since (another tab, a repeated submit) is refused, not repeated.
    if (existing.length > values.knownShipments) {
      return FAIL(
        "Междувременно за тази поръчка е създадена товарителница. " +
          "Презаредете страницата и проверете, преди да създадете нова.",
      );
    }

    if (existing.length > 0 && !values.confirmDuplicate) {
      return FAIL(
        `За тази поръчка вече има товарителница ${existing[0].shipmentNumber}. ` +
          "Отметнете потвърждението, ако наистина искате втора.",
      );
    }

    const cod = codAmountOf(values);
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
        codAmountCents: cod === null ? null : Math.round(cod * 100),
        senderDueCents: outcome.senderDueCents,
        receiverDueCents: outcome.receiverDueCents,
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
  } finally {
    if (lockedOrderId) creating.delete(lockedOrderId);
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
