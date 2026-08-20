import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration test for order creation.
 *
 * Runs against a real PostgreSQL — a throwaway PGlite instance created from
 * the same migrations production uses — so the transaction, the per-year
 * counter and the snapshot are all genuinely exercised. E-mail is stubbed so
 * nothing leaves the machine.
 */

const tmpDir = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "cbe-test-")),
  "pglite",
);

process.env.PGLITE_DIR = tmpDir;
process.env.DATABASE_URL = "";
process.env.EMAIL_PROVIDER = "console";
process.env.OWNER_NOTIFICATION_EMAIL = "owner@example.com";
process.env.APP_URL = "http://localhost:3000";

type Db = Awaited<typeof import("@/db/client")>["db"];
type Schema = typeof import("@/db/schema");

let db: Db;
let schema: Schema;
let createOrder: Awaited<typeof import("@/server/orders/service")>["createOrder"];

let categoryId = "";
let productId = "";
let dessertTypeId = "";

beforeAll(async () => {
  // Keep the log quiet: the console e-mail adapter prints full messages.
  vi.spyOn(console, "info").mockImplementation(() => {});

  const client = await import("@/db/client");
  db = client.db;
  schema = await import("@/db/schema");

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  const [category] = await db
    .insert(schema.categories)
    .values({ slug: "torti", name: "Торти" })
    .returning({ id: schema.categories.id });
  categoryId = category.id;

  const [dessert] = await db
    .insert(schema.dessertTypes)
    .values({
      slug: "torta",
      name: "Торта",
      renderer: "cake",
      basePriceCents: 4500,
    })
    .returning({ id: schema.dessertTypes.id });
  dessertTypeId = dessert.id;

  const [group] = await db
    .insert(schema.customizationGroups)
    .values({
      dessertTypeId,
      key: "shape",
      label: "Форма",
      isRequired: true,
      previewChannel: "shape",
      step: 1,
    })
    .returning({ id: schema.customizationGroups.id });

  await db.insert(schema.customizationOptions).values([
    {
      groupId: group.id,
      key: "round",
      label: "Кръгла",
      previewValue: "round",
      priceModifierCents: 0,
    },
    {
      groupId: group.id,
      key: "heart",
      label: "Сърце",
      previewValue: "heart",
      priceModifierCents: 500,
    },
  ]);

  const [product] = await db
    .insert(schema.products)
    .values({
      slug: "torta-test",
      categoryId,
      name: "Торта „Тест“",
      basePriceCents: 8000,
      portions: "16 – 20 порции",
      availability: "ACTIVE",
      shippingAllowed: true,
      pickupAllowed: true,
      shipWeightKg: "3.50",
      shipLengthCm: 40,
      shipWidthCm: 40,
      shipHeightCm: 25,
    })
    .returning({ id: schema.products.id });
  productId = product.id;

  createOrder = (await import("@/server/orders/service")).createOrder;
}, 120_000);

afterAll(() => {
  // PGlite may still hold file handles on Windows; a leftover temp directory
  // must never fail the suite.
  try {
    fs.rmSync(path.dirname(tmpDir), { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function catalogInput(overrides: Record<string, unknown> = {}) {
  return {
    payload: {
      orderType: "CATALOG" as const,
      productId,
      quantity: 1,
      occasion: "Рожден ден",
      notes: "",
      customerName: "Иван Петров",
      customerPhone: "0888123456",
      customerEmail: "ivan@example.com",
      preferredContact: "PHONE" as const,
      fulfillmentMethod: "PICKUP" as const,
      consent: true as const,
      ...overrides,
    },
    attachments: [],
    product: {
      id: productId,
      name: "Торта „Тест“",
      slug: "torta-test",
      categoryId,
      categoryName: "Торти",
      portions: "16 – 20 порции",
      basePriceCents: 8000,
      dessertTypeId: null,
      shippingAllowed: true,
      pickupAllowed: true,
      shipWeightKg: "3.50",
      shipLengthCm: 40,
      shipWidthCm: 40,
      shipHeightCm: 25,
      packageCount: 1,
    },
    dessert: null,
  };
}

describe("createOrder — catalogue", () => {
  it("creates an order with a readable number and a snapshot", async () => {
    const result = await createOrder(catalogInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const year = new Date().getUTCFullYear();
    expect(result.orderNumber).toMatch(new RegExp(`^CBE-${year}-\\d{5}$`));

    const { eq } = await import("drizzle-orm");
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, result.orderId));

    expect(order.status).toBe("NEW");
    expect(order.customerPhoneE164).toBe("+359888123456");
    expect(order.customerEmail).toBe("ivan@example.com");
    expect(order.estimatedPriceCents).toBe(8000);

    // Product defaults prefill the parcel so the owner only has to confirm it.
    expect(order.shippingWeightKg).toBe("3.50");
    expect(order.shippingLengthCm).toBe(40);

    // The QR token must be long and unguessable.
    expect(order.qrToken.length).toBeGreaterThanOrEqual(30);

    const snapshot = order.snapshot as {
      kind: string;
      lines: { group: string; value: string }[];
    };
    expect(snapshot.kind).toBe("CATALOG");
    expect(snapshot.lines).toContainEqual(
      expect.objectContaining({ group: "Продукт", value: "Торта „Тест“" }),
    );
  });

  it("records the initial status transition", async () => {
    const result = await createOrder(
      catalogInput({ customerEmail: "history@example.com" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { eq } = await import("drizzle-orm");
    const history = await db
      .select()
      .from(schema.orderStatusHistory)
      .where(eq(schema.orderStatusHistory.orderId, result.orderId));

    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe("NEW");
  });

  it("increments the order number for each new order", async () => {
    const first = await createOrder(
      catalogInput({ customerEmail: "seq1@example.com" }),
    );
    const second = await createOrder(
      catalogInput({ customerEmail: "seq2@example.com" }),
    );

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const seqOf = (n: string) => Number(n.split("-")[2]);
    expect(seqOf(second.orderNumber)).toBe(seqOf(first.orderNumber) + 1);
  });

  it("returns the existing order instead of duplicating a double submit", async () => {
    const input = catalogInput({ customerEmail: "double@example.com" });

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.duplicate).toBe(true);
    expect(second.orderNumber).toBe(first.orderNumber);
  });

  it("refuses a delivery method the product does not support", async () => {
    const input = catalogInput({
      customerEmail: "nodelivery@example.com",
      fulfillmentMethod: "ECONT_OFFICE",
    });
    input.product.shippingAllowed = false;

    const result = await createOrder(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].field).toBe("fulfillmentMethod");
  });

  it("refuses a catalogue order whose product could not be resolved", async () => {
    const input = catalogInput({ customerEmail: "missing@example.com" });
    const result = await createOrder({ ...input, product: null });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].field).toBe("productId");
  });
});

describe("createOrder — custom", () => {
  async function customInput(overrides: Record<string, unknown> = {}) {
    const { getDessertConfigById } = await import(
      "@/server/queries/configurator"
    );
    const dessert = await getDessertConfigById(dessertTypeId);

    return {
      payload: {
        orderType: "CUSTOM" as const,
        dessertTypeId,
        configState: { shape: { options: ["heart"] } },
        quantity: 1,
        occasion: "",
        notes: "",
        customerName: "Мария Иванова",
        customerPhone: "0888654321",
        customerEmail: "maria@example.com",
        preferredContact: "EMAIL" as const,
        fulfillmentMethod: "PICKUP" as const,
        consent: true as const,
        ...overrides,
      },
      attachments: [],
      product: null,
      dessert,
    };
  }

  it("stores the configuration snapshot and the raw state", async () => {
    const result = await createOrder(await customInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { eq } = await import("drizzle-orm");
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, result.orderId));

    expect(order.orderType).toBe("CUSTOM");
    expect(order.dessertTypeId).toBe(dessertTypeId);

    const snapshot = order.snapshot as {
      lines: { group: string; value: string }[];
    };
    expect(snapshot.lines).toContainEqual(
      expect.objectContaining({ group: "Форма", value: "Сърце" }),
    );

    // 4500 base + 500 for the heart shape.
    expect(order.estimatedPriceCents).toBe(5000);

    // The raw state is kept so the admin panel can replay the visualiser.
    expect(order.configState).toEqual({ shape: { options: ["heart"] } });
  });

  it("rejects a configuration option that does not exist", async () => {
    const input = await customInput({
      customerEmail: "tamper@example.com",
      configState: { shape: { options: ["triangle"] } },
    });

    const result = await createOrder(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].field).toBe("config.shape");
  });

  it("rejects a missing required group", async () => {
    const input = await customInput({
      customerEmail: "incomplete@example.com",
      configState: {},
    });

    const result = await createOrder(input);
    expect(result.ok).toBe(false);
  });
});

describe("e-mail logging", () => {
  it("records the delivery attempt against the order", async () => {
    const result = await createOrder(
      catalogInput({ customerEmail: "maillog@example.com" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Notification is fired without blocking the response; give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const { eq } = await import("drizzle-orm");
    const emails = await db
      .select()
      .from(schema.orderEmails)
      .where(eq(schema.orderEmails.orderId, result.orderId));

    expect(emails.length).toBeGreaterThanOrEqual(2);

    // The console adapter does not actually send, and says so honestly.
    for (const email of emails) {
      expect(email.status).toBe("FAILED");
      expect(email.error).toContain("console");
    }
  });
});
