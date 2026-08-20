"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  customizationGroups,
  customizationOptions,
  customizationRules,
  dessertTypes,
} from "@/db/schema";
import { slugify } from "@/lib/slug";
import { parsePriceToCents } from "@/lib/format";
import { sanitizeText } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/session";
import { describeError, FAIL, OK } from "./types";
import type { ActionResult } from "./types";

const idSchema = z.uuid();

function revalidateConfigurator() {
  revalidatePath("/order");
  revalidatePath("/admin/customizations", "layout");
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] = issue.message;
  return out;
}

/* ------------------------------------------------------------------ *
 * Dessert types
 * ------------------------------------------------------------------ */

export async function saveDessertType(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = z
      .object({
        id: idSchema.optional(),
        name: z.string().trim().min(2).max(80),
        renderer: z.string().trim().min(1).max(32),
        description: z.string().trim().max(400).optional().default(""),
        categoryId: z.string().trim().optional().default(""),
        basePrice: z.string().trim().optional().default(""),
        sortOrder: z.coerce.number().int().min(0).max(999).default(0),
        isActive: z.boolean().default(true),
      })
      .safeParse({
        id: formData.get("id") || undefined,
        name: formData.get("name"),
        renderer: formData.get("renderer") ?? "generic",
        description: formData.get("description") ?? "",
        categoryId: formData.get("categoryId") ?? "",
        basePrice: formData.get("basePrice") ?? "",
        sortOrder: formData.get("sortOrder") ?? 0,
        isActive: formData.get("isActive") === "on",
      });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    const record = {
      name: sanitizeText(values.name),
      renderer: values.renderer,
      description: sanitizeText(values.description),
      categoryId: values.categoryId || null,
      basePriceCents: values.basePrice ? parsePriceToCents(values.basePrice) : null,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      updatedAt: new Date(),
    };

    if (values.id) {
      await db
        .update(dessertTypes)
        .set(record)
        .where(eq(dessertTypes.id, values.id));
      revalidateConfigurator();
      return OK("Видът десерт е запазен.", values.id);
    }

    const existing = await db
      .select({ slug: dessertTypes.slug })
      .from(dessertTypes);
    const taken = new Set(existing.map((d) => d.slug));

    let slug = slugify(values.name) || "desert";
    let counter = 2;
    while (taken.has(slug)) slug = `${slugify(values.name)}-${counter++}`;

    const [row] = await db
      .insert(dessertTypes)
      .values({ ...record, slug })
      .returning({ id: dessertTypes.id });

    revalidateConfigurator();
    return OK("Видът десерт е създаден.", row.id);
  } catch (error) {
    console.error("saveDessertType:", error);
    return FAIL(describeError(error));
  }
}

export async function toggleDessertType(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалиден вид десерт.");

    const rows = await db
      .select({ isActive: dessertTypes.isActive })
      .from(dessertTypes)
      .where(eq(dessertTypes.id, id.data))
      .limit(1);

    if (!rows[0]) return FAIL("Видът десерт не е намерен.");

    await db
      .update(dessertTypes)
      .set({ isActive: !rows[0].isActive, updatedAt: new Date() })
      .where(eq(dessertTypes.id, id.data));

    revalidateConfigurator();
    return OK(
      rows[0].isActive
        ? "Видът десерт вече не се предлага в конфигуратора."
        : "Видът десерт отново се предлага.",
    );
  } catch (error) {
    console.error("toggleDessertType:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

const groupSchema = z.object({
  id: idSchema.optional(),
  dessertTypeId: idSchema,
  key: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Ключът трябва да е латиница без интервали."),
  label: z.string().trim().min(1).max(80),
  helpText: z.string().trim().max(240).optional().default(""),
  inputType: z.enum(["SINGLE", "MULTI", "TEXT", "NUMBER"]),
  isRequired: z.boolean().default(false),
  minSelect: z.coerce.number().int().min(0).max(12).default(0),
  maxSelect: z.coerce.number().int().min(1).max(12).default(1),
  maxLength: z.coerce.number().int().min(1).max(400).optional(),
  placeholder: z.string().trim().max(120).optional().default(""),
  previewChannel: z.string().trim().max(48).optional().default(""),
  step: z.coerce.number().int().min(1).max(20).default(1),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function saveCustomizationGroup(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const raw = Object.fromEntries(formData);
    const parsed = groupSchema.safeParse({
      ...raw,
      id: raw.id || undefined,
      isRequired: formData.get("isRequired") === "on",
      isActive: formData.get("isActive") === "on",
      maxLength: raw.maxLength ? Number(raw.maxLength) : undefined,
    });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    const duplicate = await db
      .select({ id: customizationGroups.id })
      .from(customizationGroups)
      .where(
        and(
          eq(customizationGroups.dessertTypeId, values.dessertTypeId),
          eq(customizationGroups.key, values.key),
        ),
      );

    if (duplicate.some((row) => row.id !== values.id)) {
      return FAIL(`Вече има група с ключ „${values.key}“ за този десерт.`);
    }

    const record = {
      dessertTypeId: values.dessertTypeId,
      key: values.key,
      label: sanitizeText(values.label),
      helpText: sanitizeText(values.helpText),
      inputType: values.inputType,
      isRequired: values.isRequired,
      minSelect: values.minSelect,
      maxSelect: Math.max(values.minSelect || 1, values.maxSelect),
      maxLength: values.maxLength ?? null,
      placeholder: sanitizeText(values.placeholder),
      previewChannel: values.previewChannel,
      step: values.step,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      updatedAt: new Date(),
    };

    if (values.id) {
      await db
        .update(customizationGroups)
        .set(record)
        .where(eq(customizationGroups.id, values.id));
    } else {
      await db.insert(customizationGroups).values(record);
    }

    revalidateConfigurator();
    return OK("Групата е запазена.");
  } catch (error) {
    console.error("saveCustomizationGroup:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteCustomizationGroup(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна група.");

    await db
      .delete(customizationGroups)
      .where(eq(customizationGroups.id, id.data));

    revalidateConfigurator();
    return OK("Групата и нейните опции са изтрити.");
  } catch (error) {
    console.error("deleteCustomizationGroup:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Options
 * ------------------------------------------------------------------ */

const optionSchema = z.object({
  id: idSchema.optional(),
  groupId: idSchema,
  key: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Ключът трябва да е латиница/цифри."),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional().default(""),
  price: z.string().trim().optional().default(""),
  previewValue: z.string().trim().max(48).optional().default(""),
  swatchColor: z.string().trim().max(9).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export async function saveCustomizationOption(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const raw = Object.fromEntries(formData);
    const parsed = optionSchema.safeParse({
      ...raw,
      id: raw.id || undefined,
      isActive: formData.get("isActive") === "on",
    });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    if (values.swatchColor && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(values.swatchColor)) {
      return FAIL("Цветът трябва да е в HEX формат, например #f2d7d7.");
    }

    const duplicate = await db
      .select({ id: customizationOptions.id })
      .from(customizationOptions)
      .where(
        and(
          eq(customizationOptions.groupId, values.groupId),
          eq(customizationOptions.key, values.key),
        ),
      );

    if (duplicate.some((row) => row.id !== values.id)) {
      return FAIL(`Вече има опция с ключ „${values.key}“ в тази група.`);
    }

    const record = {
      groupId: values.groupId,
      key: values.key,
      label: sanitizeText(values.label),
      description: sanitizeText(values.description),
      priceModifierCents: values.price ? parsePriceToCents(values.price) : null,
      previewValue: values.previewValue || values.swatchColor || "",
      swatchColor: values.swatchColor || null,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      updatedAt: new Date(),
    };

    if (values.id) {
      await db
        .update(customizationOptions)
        .set(record)
        .where(eq(customizationOptions.id, values.id));
    } else {
      await db.insert(customizationOptions).values(record);
    }

    revalidateConfigurator();
    return OK("Опцията е запазена.");
  } catch (error) {
    console.error("saveCustomizationOption:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteCustomizationOption(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна опция.");

    await db
      .delete(customizationOptions)
      .where(eq(customizationOptions.id, id.data));

    revalidateConfigurator();
    return OK("Опцията е изтрита.");
  } catch (error) {
    console.error("deleteCustomizationOption:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

export async function saveCustomizationRule(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = z
      .object({
        dessertTypeId: idSchema,
        targetType: z.enum(["GROUP", "OPTION"]),
        targetKey: z.string().trim().min(1).max(48),
        targetGroupKey: z.string().trim().max(48).optional().default(""),
        mode: z.enum(["SHOW_WHEN", "HIDE_WHEN"]),
        whenGroupKey: z.string().trim().min(1).max(48),
        whenOptionKeys: z.string().trim().min(1).max(400),
      })
      .safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    if (values.targetType === "OPTION" && !values.targetGroupKey) {
      return FAIL("За правило върху опция посочете и групата ѝ.");
    }

    await db.insert(customizationRules).values({
      dessertTypeId: values.dessertTypeId,
      targetType: values.targetType,
      targetKey: values.targetKey,
      targetGroupKey: values.targetGroupKey || null,
      mode: values.mode,
      whenGroupKey: values.whenGroupKey,
      whenOptionKeys: values.whenOptionKeys
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    });

    revalidateConfigurator();
    return OK("Правилото е добавено.");
  } catch (error) {
    console.error("saveCustomizationRule:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteCustomizationRule(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидно правило.");

    await db
      .delete(customizationRules)
      .where(eq(customizationRules.id, id.data));

    revalidateConfigurator();
    return OK("Правилото е изтрито.");
  } catch (error) {
    console.error("deleteCustomizationRule:", error);
    return FAIL(describeError(error));
  }
}
