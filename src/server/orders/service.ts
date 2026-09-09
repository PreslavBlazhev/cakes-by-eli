import { randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  orderAttachments,
  orderCounters,
  orders,
  orderStatusHistory,
} from "@/db/schema";
import {
  buildSummary,
  estimatePrice,
  validateState,
} from "@/features/configurator/rules";
import type { ConfigState, DessertTypeConfig } from "@/features/configurator/types";
import {
  buildCatalogSnapshot,
  buildCustomSnapshot,
  readSnapshot,
  snapshotTitle,
} from "@/features/orders/snapshot";
import type { OrderSnapshot } from "@/features/orders/snapshot";
import { runSafely, scheduleAfterResponse } from "@/lib/after-response";
import { env } from "@/lib/env";
import {
  customerOrderEmail,
  ownerOrderEmail,
} from "@/lib/email/templates";
import {
  replyToAddress,
  sendCustomerOrderReceivedEmail,
  sendNewOrderAdminEmail,
} from "@/lib/email/service";
import { normalizeBgPhone } from "@/lib/format";
import { FULFILLMENT_LABELS } from "@/lib/labels";
import { sanitizeText } from "@/lib/validation";
import type { OrderPayload } from "@/lib/validation";
import type { StoredFile } from "@/lib/storage";

export type CreateOrderInput = {
  payload: OrderPayload;
  /** Already-validated and stored uploads. */
  attachments: { file: StoredFile; originalName: string }[];
  product: {
    id: string;
    name: string;
    slug: string;
    categoryId: string;
    categoryName: string;
    portions: string | null;
    basePriceCents: number | null;
    dessertTypeId: string | null;
    shippingAllowed: boolean;
    pickupAllowed: boolean;
    shipWeightKg: string | null;
    shipLengthCm: number | null;
    shipWidthCm: number | null;
    shipHeightCm: number | null;
    packageCount: number;
  } | null;
  dessert: DessertTypeConfig | null;
};

export type CreateOrderResult =
  | { ok: true; orderNumber: string; orderId: string; duplicate: boolean }
  | { ok: false; errors: { field: string; message: string }[] };

/**
 * Creates an order.
 *
 * The database write is a single transaction, so a failure never leaves a
 * half-built order behind. E-mail is sent only after the transaction commits —
 * a provider outage must not lose the order.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const { payload, attachments, product, dessert } = input;
  const errors: { field: string; message: string }[] = [];

  /* ---------------------------------------------------- Server re-checks */

  if (payload.orderType === "CATALOG") {
    if (!product) {
      return {
        ok: false,
        errors: [
          {
            field: "productId",
            message: "Продуктът не е наличен за поръчка. Моля, изберете друг.",
          },
        ],
      };
    }
  } else if (!dessert) {
    return {
      ok: false,
      errors: [
        {
          field: "dessertTypeId",
          message: "Този вид десерт вече не е достъпен. Моля, изберете друг.",
        },
      ],
    };
  }

  // Shipping method must be one the product actually supports.
  if (product) {
    if (payload.fulfillmentMethod === "PICKUP" && !product.pickupAllowed) {
      errors.push({
        field: "fulfillmentMethod",
        message: "Този продукт не се предлага за вземане на място.",
      });
    }
    if (
      payload.fulfillmentMethod !== "PICKUP" &&
      !product.shippingAllowed
    ) {
      errors.push({
        field: "fulfillmentMethod",
        message:
          "Този продукт не може да се изпраща с куриер. Моля, изберете вземане на място.",
      });
    }
  }

  let snapshot: OrderSnapshot;
  let configState: ConfigState | null = null;

  if (payload.orderType === "CUSTOM" && dessert) {
    configState = (payload.configState ?? {}) as ConfigState;

    const issues = validateState(dessert, configState);
    if (issues.length > 0) {
      return {
        ok: false,
        errors: issues.map((issue) => ({
          field: `config.${issue.groupKey}`,
          message: issue.message,
        })),
      };
    }

    const summary = buildSummary(dessert, configState);
    const price = estimatePrice(dessert, configState, payload.quantity);

    snapshot = buildCustomSnapshot({
      dessert: {
        id: dessert.id,
        name: dessert.name,
        slug: dessert.slug,
        renderer: dessert.renderer,
        basePriceCents: dessert.basePriceCents,
      },
      summary,
      quantity: payload.quantity,
      estimatedPriceCents: price.totalCents,
    });
  } else if (product) {
    snapshot = buildCatalogSnapshot({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        portions: product.portions,
        basePriceCents: product.basePriceCents,
      },
      quantity: payload.quantity,
    });
  } else {
    return {
      ok: false,
      errors: [{ field: "orderType", message: "Невалидна поръчка." }],
    };
  }

  if (errors.length > 0) return { ok: false, errors };

  /* ------------------------------------------------- Duplicate guard */

  const phoneE164 = normalizeBgPhone(payload.customerPhone) ?? payload.customerPhone;
  const fingerprint = snapshotFingerprint(snapshot);

  const recent = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      snapshot: orders.snapshot,
    })
    .from(orders)
    .where(
      and(
        eq(orders.customerEmail, payload.customerEmail.toLowerCase()),
        gte(orders.createdAt, new Date(Date.now() - 90_000)),
      ),
    )
    .limit(5);

  const duplicate = recent.find((row) => {
    const existing = readSnapshot(row.snapshot);
    return existing ? snapshotFingerprint(existing) === fingerprint : false;
  });

  if (duplicate) {
    // A double click or a retried request — hand back the order that already
    // exists rather than creating a second one.
    return {
      ok: true,
      orderId: duplicate.id,
      orderNumber: duplicate.orderNumber,
      duplicate: true,
    };
  }

  /* -------------------------------------------------------- Persistence */

  const shipping = payload.shipping;
  const shippingRequired = payload.fulfillmentMethod !== "PICKUP";
  const qrToken = randomBytes(24).toString("base64url");

  const created = await db.transaction(async (tx) => {
    const year = new Date().getUTCFullYear();

    // Atomic per-year sequence; concurrent submissions can never collide.
    const counter = await tx
      .insert(orderCounters)
      .values({ year, lastSeq: 1 })
      .onConflictDoUpdate({
        target: orderCounters.year,
        set: { lastSeq: sql`${orderCounters.lastSeq} + 1` },
      })
      .returning({ lastSeq: orderCounters.lastSeq });

    const seq = counter[0]?.lastSeq ?? 1;
    const orderNumber = `CBE-${year}-${String(seq).padStart(5, "0")}`;

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        year,
        seq,
        orderType: payload.orderType,
        status: "NEW",

        customerName: sanitizeText(payload.customerName),
        customerPhone: sanitizeText(payload.customerPhone),
        customerPhoneE164: phoneE164,
        customerEmail: payload.customerEmail.toLowerCase(),
        preferredContact: payload.preferredContact,

        fulfillmentDate: payload.fulfillmentDate ?? null,
        occasion: sanitizeText(payload.occasion ?? ""),
        quantity: payload.quantity,
        notes: sanitizeText(payload.notes ?? ""),
        fulfillmentMethod: payload.fulfillmentMethod,

        productId: product?.id ?? null,
        dessertTypeId: dessert?.id ?? product?.dessertTypeId ?? null,

        snapshot,
        configState,

        estimatedPriceCents: snapshot.estimatedPriceCents,
        priceIsEstimate: true,

        shipRecipientName: shippingRequired
          ? sanitizeText(shipping?.recipientName ?? "")
          : null,
        shipRecipientPhone: shippingRequired
          ? sanitizeText(shipping?.recipientPhone ?? "")
          : null,
        shipCityId: shippingRequired ? (shipping?.cityId ?? null) : null,
        shipCityName: shippingRequired ? (shipping?.cityName ?? "") : null,
        shipPostCode: shippingRequired ? (shipping?.postCode ?? "") : null,
        shipQuarter: shippingRequired ? (shipping?.quarter ?? "") : null,
        shipStreet: shippingRequired ? (shipping?.street ?? "") : null,
        shipStreetNum: shippingRequired ? (shipping?.streetNum ?? "") : null,
        shipOther: shippingRequired ? sanitizeText(shipping?.other ?? "") : null,
        shipOfficeCode: shippingRequired ? (shipping?.officeCode ?? "") : null,
        shipOfficeName: shippingRequired ? (shipping?.officeName ?? "") : null,

        // Product defaults prefill the parcel; the owner corrects them before
        // a waybill is generated.
        shippingWeightKg: product?.shipWeightKg ?? null,
        shippingLengthCm: product?.shipLengthCm ?? null,
        shippingWidthCm: product?.shipWidthCm ?? null,
        shippingHeightCm: product?.shipHeightCm ?? null,
        shippingDescription: snapshotTitle(snapshot),
        packageCount: product?.packageCount ?? 1,

        qrToken,
        consentAcceptedAt: new Date(),
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    if (attachments.length > 0) {
      await tx.insert(orderAttachments).values(
        attachments.map((attachment) => ({
          orderId: order.id,
          path: attachment.file.url,
          originalName: sanitizeText(attachment.originalName).slice(0, 180),
          mimeType: attachment.file.mimeType,
          sizeBytes: attachment.file.sizeBytes,
        })),
      );
    }

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: "NEW",
      note: "Поръчката е получена през сайта.",
      actor: "клиент",
    });

    return order;
  });

  /* ----------------------------------------------------------- E-mails */

  // Deliberately after the commit: the order is durable regardless of the
  // e-mail provider's health, and every attempt is logged against the order.
  await scheduleAfterResponse(() =>
    notify({
      orderId: created.id,
      orderNumber: created.orderNumber,
      payload,
      snapshot,
      attachmentCount: attachments.length,
    }),
  );

  return {
    ok: true,
    orderId: created.id,
    orderNumber: created.orderNumber,
    duplicate: false,
  };
}

async function notify(input: {
  orderId: string;
  orderNumber: string;
  payload: OrderPayload;
  snapshot: OrderSnapshot;
  attachmentCount: number;
}) {
  const { payload, snapshot } = input;

  const settingsModule = await import("@/server/queries/settings");
  const settings = await settingsModule.getSettings();

  const shippingSummary =
    payload.fulfillmentMethod === "PICKUP"
      ? null
      : [
          payload.shipping?.recipientName,
          payload.shipping?.recipientPhone,
          payload.shipping?.officeName ||
            [
              payload.shipping?.cityName,
              payload.shipping?.quarter,
              payload.shipping?.street,
              payload.shipping?.streetNum,
              payload.shipping?.other,
            ]
              .filter(Boolean)
              .join(", "),
        ]
          .filter(Boolean)
          .join(" · ");

  const data = {
    orderNumber: input.orderNumber,
    orderType: payload.orderType,
    status: "NEW" as const,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerEmail: payload.customerEmail,
    preferredContact: payload.preferredContact,
    fulfillmentDate: payload.fulfillmentDate ?? null,
    fulfillmentMethod: payload.fulfillmentMethod,
    occasion: payload.occasion ?? "",
    quantity: payload.quantity,
    notes: payload.notes ?? "",
    snapshot,
    attachmentCount: input.attachmentCount,
    shippingSummary: shippingSummary || null,
    businessName: settings.businessName,
    adminUrl: `${env.APP_URL}/admin/orders/${input.orderId}`,
    disclaimer:
      settings.orderDisclaimer ||
      `Поръчката се счита за потвърдена след потвърждение от ${settings.businessName}.`,
  };

  // The two notifications are independent: whatever goes wrong with the
  // owner's copy must not stop the customer's, and vice versa. Each send
  // records its own row in `order_emails`, so a failure is visible in the
  // admin panel rather than merely logged.
  await settle("OWNER_NEW_ORDER", async () => {
    const owner = ownerOrderEmail(data);
    await sendNewOrderAdminEmail(input.orderId, {
      subject: owner.subject,
      html: owner.html,
      text: owner.text,
      replyTo: payload.customerEmail,
    });
  });

  await settle("CUSTOMER_RECEIVED", async () => {
    const customer = customerOrderEmail(data);
    await sendCustomerOrderReceivedEmail(input.orderId, {
      to: payload.customerEmail,
      subject: customer.subject,
      html: customer.html,
      text: customer.text,
      replyTo: replyToAddress(),
    });
  });
}

/** Runs one notification, keeping its failure to itself. */
async function settle(kind: string, send: () => Promise<void>): Promise<void> {
  // No addresses and no message bodies — only which notification failed.
  await runSafely(send, "ORDER_EMAIL_FAILED", { kind });
}

/** Human sentence for the delivery method, used in confirmations. */
export function fulfillmentSentence(
  method: keyof typeof FULFILLMENT_LABELS,
): string {
  return FULFILLMENT_LABELS[method];
}

/**
 * Stable fingerprint of what was ordered, used to recognise a double submit.
 *
 * PostgreSQL's jsonb does not preserve key order, so a round-tripped snapshot
 * serialises differently from the one just built in memory. Comparing an
 * explicit projection keeps the two comparable.
 */
function snapshotFingerprint(snapshot: OrderSnapshot): string {
  const subject =
    snapshot.kind === "CATALOG"
      ? (snapshot.product?.id ?? "")
      : (snapshot.dessert?.id ?? "");

  const lines = snapshot.lines
    .map((line) => `${line.groupKey}=${line.value}`)
    .join("|");

  return `${snapshot.kind}:${subject}:${snapshot.quantity}:${lines}`;
}
