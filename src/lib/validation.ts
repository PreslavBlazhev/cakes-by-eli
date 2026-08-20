import { z } from "zod";
import {
  DETAIL_COUNT_MAX,
  DETAIL_COUNT_MIN,
  DETAIL_TIER_MAX,
} from "@/features/configurator/types";

import { normalizeBgPhone } from "@/lib/format";

/**
 * Server-side contract for an order submission.
 *
 * The browser validates the same shapes for instant feedback, but nothing here
 * trusts the client: ids are re-resolved against the database and the
 * configuration is re-validated against the dessert type's own rules.
 */

const trimmed = z.string().trim();

export const nameSchema = trimmed
  .min(2, "Моля, въведете име.")
  .max(80, "Името е твърде дълго.");

export const phoneSchema = trimmed
  .min(6, "Моля, въведете телефон.")
  .max(24, "Телефонът е твърде дълъг.")
  .refine((value) => normalizeBgPhone(value) !== null, {
    message: "Моля, въведете валиден български телефон.",
  });

export const emailSchema = trimmed
  .min(5, "Моля, въведете имейл.")
  .max(160, "Имейлът е твърде дълъг.")
  .pipe(z.email({ message: "Моля, въведете валиден имейл адрес." }));

/** Calendar date in `YYYY-MM-DD`, bounded to a sensible ordering window. */
export const fulfillmentDateSchema = trimmed
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Моля, изберете валидна дата.")
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return false;
    const year = date.getUTCFullYear();
    return year >= 2020 && year <= 2100;
  }, "Моля, изберете валидна дата.");

/**
 * Per-option settings. The bounds are duplicated from the configurator's
 * constants on purpose: this is the outer wall, and it must hold even if a
 * future UI forgets to clamp.
 */
export const optionDetailSchema = z.object({
  tier: z.number().int().min(0).max(DETAIL_TIER_MAX).optional(),
  count: z
    .number()
    .int()
    .min(DETAIL_COUNT_MIN)
    .max(DETAIL_COUNT_MAX)
    .optional(),
});

export const configValueSchema = z.object({
  options: z.array(trimmed.min(1).max(64)).max(12).optional(),
  text: z.string().max(400).optional(),
  number: z.number().finite().min(1).max(100000).optional(),
  details: z.record(trimmed.min(1).max(64), optionDetailSchema).optional(),
});

export const configStateSchema = z.record(
  trimmed.min(1).max(64),
  configValueSchema,
);

export const shippingSchema = z.object({
  recipientName: trimmed.max(80).optional().default(""),
  recipientPhone: trimmed.max(24).optional().default(""),
  cityId: z.number().int().positive().nullable().optional(),
  cityName: trimmed.max(80).optional().default(""),
  postCode: trimmed.max(12).optional().default(""),
  quarter: trimmed.max(120).optional().default(""),
  street: trimmed.max(120).optional().default(""),
  streetNum: trimmed.max(20).optional().default(""),
  other: trimmed.max(240).optional().default(""),
  officeCode: trimmed.max(20).optional().default(""),
  officeName: trimmed.max(160).optional().default(""),
});

export const orderPayloadSchema = z
  .object({
    orderType: z.enum(["CATALOG", "CUSTOM"]),
    productId: z.uuid().optional(),
    dessertTypeId: z.uuid().optional(),
    configState: configStateSchema.optional(),

    quantity: z.coerce.number().int().min(1).max(500).default(1),
    fulfillmentDate: fulfillmentDateSchema.optional(),
    occasion: trimmed.max(120).optional().default(""),
    notes: trimmed.max(2000).optional().default(""),

    customerName: nameSchema,
    customerPhone: phoneSchema,
    customerEmail: emailSchema,
    preferredContact: z.enum(["PHONE", "EMAIL", "VIBER"]).default("PHONE"),

    fulfillmentMethod: z
      .enum(["PICKUP", "ECONT_OFFICE", "ECONT_ADDRESS"])
      .default("PICKUP"),
    shipping: shippingSchema.optional(),

    consent: z.literal(true, {
      message: "Необходимо е съгласие за обработка на данните.",
    }),
  })
  .superRefine((value, ctx) => {
    if (value.orderType === "CATALOG" && !value.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Моля, изберете продукт.",
      });
    }

    if (value.orderType === "CUSTOM" && !value.dessertTypeId) {
      ctx.addIssue({
        code: "custom",
        path: ["dessertTypeId"],
        message: "Моля, изберете вид десерт.",
      });
    }

    if (value.fulfillmentMethod === "ECONT_OFFICE") {
      if (!value.shipping?.officeCode) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping", "officeCode"],
          message: "Моля, изберете офис на Еконт.",
        });
      }
    }

    if (value.fulfillmentMethod === "ECONT_ADDRESS") {
      if (!value.shipping?.cityName) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping", "cityName"],
          message: "Моля, изберете населено място.",
        });
      }
      const hasStreet = Boolean(
        value.shipping?.street && value.shipping?.streetNum,
      );
      const hasOther = Boolean(value.shipping?.other);
      if (!hasStreet && !hasOther) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping", "street"],
          message:
            "Посочете улица и номер или попълнете допълнително описание на адреса.",
        });
      }
    }

    if (value.fulfillmentMethod !== "PICKUP") {
      if (!value.shipping?.recipientName) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping", "recipientName"],
          message: "Моля, въведете име на получателя.",
        });
      }
      if (
        value.shipping?.recipientPhone &&
        normalizeBgPhone(value.shipping.recipientPhone) === null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["shipping", "recipientPhone"],
          message: "Телефонът на получателя не е валиден.",
        });
      }
    }
  });

export type OrderPayload = z.infer<typeof orderPayloadSchema>;

/* ------------------------------------------------------------------ *
 * Uploads
 * ------------------------------------------------------------------ */

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

/** Magic-byte signatures — the declared MIME type alone is not trusted. */
const SIGNATURES: { type: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    type: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: "image/png",
    test: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    type: "image/webp",
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/** Returns the real image type, or null when the bytes are not an allowed image. */
export function sniffImageType(bytes: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    if (bytes.length >= 12 && signature.test(bytes)) return signature.type;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

export const loginSchema = z.object({
  email: trimmed.min(3).max(160),
  password: z.string().min(1, "Моля, въведете парола.").max(200),
});

export const orderStatusSchema = z.enum([
  "NEW",
  "REVIEWING",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
]);

export const timeSchema = trimmed.regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  "Часът трябва да е във формат ЧЧ:ММ.",
);

/** Strips control characters that have no business in a stored text field. */
export function sanitizeText(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const isControl = code < 32 || code === 127;
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    if (isControl && !isAllowedWhitespace) continue;
    out += char;
  }
  return out.trim();
}
