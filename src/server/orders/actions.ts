"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { categories, products } from "@/db/schema";
import { env } from "@/lib/env";
import { ORDERABLE_AVAILABILITY } from "@/lib/labels";
import { isDateBlockedForOrders } from "@/lib/schedule";
import { keyFromUrl, storage, storeUploadedImage } from "@/lib/storage";
import type { StoredFile } from "@/lib/storage";
import { orderPayloadSchema } from "@/lib/validation";
import { getDessertConfigById } from "@/server/queries/configurator";
import { getUpcomingExceptions } from "@/server/queries/settings";
import { createOrder } from "./service";

export type SubmitOrderState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
    }
  | { status: "success"; orderNumber: string };

/**
 * Public entry point for an order submission.
 *
 * Everything arriving here is untrusted: ids are re-resolved against the
 * database, the configuration is re-validated against the dessert's own rules,
 * and uploads are checked by magic bytes before they are written anywhere.
 */
export async function submitOrder(
  _previous: SubmitOrderState,
  formData: FormData,
): Promise<SubmitOrderState> {
  const raw = formData.get("payload");

  if (typeof raw !== "string") {
    return {
      status: "error",
      message: "Заявката е непълна. Моля, опитайте отново.",
      fieldErrors: {},
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      status: "error",
      message: "Заявката е повредена. Моля, презаредете страницата.",
      fieldErrors: {},
    };
  }

  const parsed = orderPayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Моля, проверете отбелязаните полета.",
      fieldErrors,
    };
  }

  const payload = parsed.data;

  /* ------------------------------------------- Resolve trusted entities */

  let product: Awaited<ReturnType<typeof resolveProduct>> = null;

  if (payload.orderType === "CATALOG" && payload.productId) {
    product = await resolveProduct(payload.productId);
    if (!product) {
      return {
        status: "error",
        message: "Избраният продукт вече не е наличен за поръчка.",
        fieldErrors: { productId: "Моля, изберете друг продукт." },
      };
    }
  }

  const dessert =
    payload.orderType === "CUSTOM" && payload.dessertTypeId
      ? await getDessertConfigById(payload.dessertTypeId)
      : null;

  if (payload.orderType === "CUSTOM" && !dessert) {
    return {
      status: "error",
      message: "Избраният вид десерт вече не е достъпен.",
      fieldErrors: { dessertTypeId: "Моля, изберете друг вид." },
    };
  }

  /* ------------------------------------------------ Blocked date check */

  if (payload.fulfillmentDate) {
    const exceptions = await getUpcomingExceptions();
    const blocked = isDateBlockedForOrders(payload.fulfillmentDate, exceptions);
    if (blocked.blocked) {
      const reason = blocked.reason ?? "За тази дата не се приемат поръчки.";
      return {
        status: "error",
        message: reason,
        fieldErrors: { fulfillmentDate: reason },
      };
    }
  }

  /* ------------------------------------------------------- Attachments */

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > env.UPLOAD_MAX_FILES) {
    return {
      status: "error",
      message: `Може да прикачите най-много ${env.UPLOAD_MAX_FILES} снимки.`,
      fieldErrors: { files: "Твърде много файлове." },
    };
  }

  const accepted: { file: StoredFile; originalName: string }[] = [];

  const discardUploads = async () => {
    await Promise.all(
      accepted.map((item) => storage().remove(keyFromUrl(item.file.url))),
    );
  };

  for (const file of files) {
    const result = await storeUploadedImage(file, "orders");

    if (!result.ok) {
      // Roll back anything already written before reporting the failure.
      await discardUploads();
      return {
        status: "error",
        message: `„${result.originalName}“: ${result.error}`,
        fieldErrors: { files: result.error },
      };
    }

    accepted.push({ file: result.file, originalName: result.originalName });
  }

  /* ------------------------------------------------------------ Create */

  try {
    const result = await createOrder({
      payload,
      attachments: accepted,
      product,
      dessert,
    });

    if (!result.ok) {
      await discardUploads();
      const fieldErrors: Record<string, string> = {};
      for (const error of result.errors) fieldErrors[error.field] = error.message;
      return {
        status: "error",
        message: "Моля, проверете отбелязаните полета.",
        fieldErrors,
      };
    }

    return { status: "success", orderNumber: result.orderNumber };
  } catch (error) {
    console.error("Създаването на поръчка се провали:", error);
    await discardUploads();
    return {
      status: "error",
      message:
        "Възникна техническа грешка при записа на поръчката. Моля, опитайте отново или се обадете по телефона.",
      fieldErrors: {},
    };
  }
}

async function resolveProduct(id: string) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      categoryId: products.categoryId,
      categoryName: categories.name,
      portions: products.portions,
      basePriceCents: products.basePriceCents,
      dessertTypeId: products.dessertTypeId,
      shippingAllowed: products.shippingAllowed,
      pickupAllowed: products.pickupAllowed,
      shipWeightKg: products.shipWeightKg,
      shipLengthCm: products.shipLengthCm,
      shipWidthCm: products.shipWidthCm,
      shipHeightCm: products.shipHeightCm,
      packageCount: products.packageCount,
      availability: products.availability,
      archivedAt: products.archivedAt,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.id, id)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.archivedAt) return null;
  if (!ORDERABLE_AVAILABILITY.includes(row.availability)) return null;

  return row;
}
