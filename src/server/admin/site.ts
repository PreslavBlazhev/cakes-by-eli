"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  announcements,
  galleryItems,
  scheduleExceptions,
  siteSettings,
  workingHours,
} from "@/db/schema";
import { readHomeContentForm } from "@/lib/home-content";
import { storeUploadedImage } from "@/lib/storage";
import { sanitizeText, timeSchema } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/session";
import { removeImageFileIfUnused } from "./images";
import { describeError, FAIL, OK } from "./types";
import type { ActionResult } from "./types";

const idSchema = z.uuid();

function revalidatePublic() {
  revalidatePath("/", "layout");
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[issue.path.join(".")] = issue.message;
  return out;
}

/* ------------------------------------------------------------------ *
 * Business information and website copy
 * ------------------------------------------------------------------ */

const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().max(160).optional().default(""),
  addressLine: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  mapsUrl: z.string().trim().max(500).optional().default(""),
  facebookUrl: z.string().trim().max(500).optional().default(""),
  instagramUrl: z.string().trim().max(500).optional().default(""),

  topbarText: z.string().trim().max(200).optional().default(""),
  heroEyebrow: z.string().trim().max(80).optional().default(""),
  heroTitle: z.string().trim().max(80).optional().default(""),
  heroTitleAccent: z.string().trim().max(80).optional().default(""),
  heroSubtitle: z.string().trim().max(400).optional().default(""),

  aboutEyebrow: z.string().trim().max(80).optional().default(""),
  aboutTitle: z.string().trim().max(120).optional().default(""),
  aboutText: z.string().trim().max(2000).optional().default(""),
  aboutQuote: z.string().trim().max(300).optional().default(""),

  contactIntro: z.string().trim().max(400).optional().default(""),
  orderDisclaimer: z.string().trim().max(400).optional().default(""),
  metaDescription: z.string().trim().max(300).optional().default(""),
});

/** Only http(s) links are accepted; anything else is rejected outright. */
function safeUrl(value: string, field: string): string | { error: string } {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { error: `${field}: адресът трябва да започва с https://` };
    }
    return url.toString();
  } catch {
    return { error: `${field}: адресът не е валиден.` };
  }
}

export async function saveSiteSettings(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;
    const urlFields: [keyof typeof values, string][] = [
      ["mapsUrl", "Google Maps"],
      ["facebookUrl", "Facebook"],
      ["instagramUrl", "Instagram"],
    ];

    const cleaned: Record<string, string> = {};
    for (const [field, label] of urlFields) {
      const result = safeUrl(String(values[field] ?? ""), label);
      if (typeof result !== "string") return FAIL(result.error);
      cleaned[field] = result;
    }

    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      return FAIL("Имейл адресът не е валиден.", {
        email: "Невалиден имейл адрес.",
      });
    }

    const record = {
      ...values,
      ...cleaned,
      businessName: sanitizeText(values.businessName),
      aboutText: sanitizeText(values.aboutText),
      aboutTitle: sanitizeText(values.aboutTitle),
      heroSubtitle: sanitizeText(values.heroSubtitle),
      aboutQuote: sanitizeText(values.aboutQuote),
      homeContent: readHomeContentForm(formData, sanitizeText),
      updatedAt: new Date(),
    };

    const existing = await db
      .select({ id: siteSettings.id })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1));

    if (existing.length === 0) {
      await db.insert(siteSettings).values({ id: 1, ...record });
    } else {
      await db.update(siteSettings).set(record).where(eq(siteSettings.id, 1));
    }

    revalidatePublic();
    return OK("Съдържанието на сайта е запазено.");
  } catch (error) {
    console.error("saveSiteSettings:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Working hours
 * ------------------------------------------------------------------ */

export async function saveWorkingHours(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const rows: {
      weekday: number;
      isClosed: boolean;
      opensAt: string | null;
      closesAt: string | null;
    }[] = [];

    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const isClosed = formData.get(`closed-${weekday}`) === "on";
      const opensAt = String(formData.get(`opens-${weekday}`) ?? "").trim();
      const closesAt = String(formData.get(`closes-${weekday}`) ?? "").trim();

      if (!isClosed) {
        const openCheck = timeSchema.safeParse(opensAt);
        const closeCheck = timeSchema.safeParse(closesAt);

        if (!openCheck.success || !closeCheck.success) {
          return FAIL(
            "Моля, попълнете начален и краен час за всички работни дни (ЧЧ:ММ).",
          );
        }
        if (openCheck.data >= closeCheck.data) {
          return FAIL("Краят на работния ден трябва да е след началото.");
        }
      }

      rows.push({
        weekday,
        isClosed,
        opensAt: isClosed || !opensAt ? null : `${opensAt}:00`,
        closesAt: isClosed || !closesAt ? null : `${closesAt}:00`,
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(workingHours);
      await tx.insert(workingHours).values(rows);
    });

    revalidatePublic();
    return OK("Работното време е запазено.");
  } catch (error) {
    console.error("saveWorkingHours:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Schedule exceptions
 * ------------------------------------------------------------------ */

const exceptionSchema = z
  .object({
    id: idSchema.optional(),
    date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Изберете дата."),
    isClosed: z.boolean().default(true),
    opensAt: z.string().trim().optional().default(""),
    closesAt: z.string().trim().optional().default(""),
    blocksOrders: z.boolean().default(false),
    note: z.string().trim().max(200).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.isClosed) return;
    if (!timeSchema.safeParse(value.opensAt).success) {
      ctx.addIssue({ code: "custom", path: ["opensAt"], message: "Невалиден час." });
    }
    if (!timeSchema.safeParse(value.closesAt).success) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Невалиден час." });
    }
  });

export async function saveScheduleException(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = exceptionSchema.safeParse({
      id: formData.get("id") || undefined,
      date: formData.get("date"),
      isClosed: formData.get("isClosed") === "on",
      opensAt: formData.get("opensAt") ?? "",
      closesAt: formData.get("closesAt") ?? "",
      blocksOrders: formData.get("blocksOrders") === "on",
      note: formData.get("note") ?? "",
    });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;
    const record = {
      date: values.date,
      isClosed: values.isClosed,
      opensAt: values.isClosed ? null : `${values.opensAt}:00`,
      closesAt: values.isClosed ? null : `${values.closesAt}:00`,
      blocksOrders: values.blocksOrders,
      note: sanitizeText(values.note),
    };

    if (values.id) {
      await db
        .update(scheduleExceptions)
        .set(record)
        .where(eq(scheduleExceptions.id, values.id));
    } else {
      await db
        .insert(scheduleExceptions)
        .values(record)
        .onConflictDoUpdate({ target: scheduleExceptions.date, set: record });
    }

    revalidatePublic();
    return OK("Изключението е запазено.");
  } catch (error) {
    console.error("saveScheduleException:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteScheduleException(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидно изключение.");

    await db.delete(scheduleExceptions).where(eq(scheduleExceptions.id, id.data));

    revalidatePublic();
    return OK("Изключението е премахнато.");
  } catch (error) {
    console.error("deleteScheduleException:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

const announcementSchema = z.object({
  id: idSchema.optional(),
  text: z.string().trim().min(3, "Текстът е задължителен.").max(240),
  linkUrl: z.string().trim().max(500).optional().default(""),
  linkLabel: z.string().trim().max(60).optional().default(""),
  isActive: z.boolean().default(true),
  startsAt: z.string().trim().optional().default(""),
  endsAt: z.string().trim().optional().default(""),
});

export async function saveAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = announcementSchema.safeParse({
      id: formData.get("id") || undefined,
      text: formData.get("text"),
      linkUrl: formData.get("linkUrl") ?? "",
      linkLabel: formData.get("linkLabel") ?? "",
      isActive: formData.get("isActive") === "on",
      startsAt: formData.get("startsAt") ?? "",
      endsAt: formData.get("endsAt") ?? "",
    });

    if (!parsed.success) {
      return FAIL("Моля, проверете полетата.", fieldErrors(parsed.error));
    }

    const values = parsed.data;

    // Only same-site paths or absolute http(s) links may be published.
    let linkUrl: string | null = null;
    if (values.linkUrl) {
      if (values.linkUrl.startsWith("/")) linkUrl = values.linkUrl;
      else {
        const checked = safeUrl(values.linkUrl, "Връзка");
        if (typeof checked !== "string") return FAIL(checked.error);
        linkUrl = checked;
      }
    }

    const record = {
      text: sanitizeText(values.text),
      linkUrl,
      linkLabel: values.linkLabel ? sanitizeText(values.linkLabel) : null,
      isActive: values.isActive,
      startsAt: values.startsAt ? new Date(values.startsAt) : null,
      endsAt: values.endsAt ? new Date(values.endsAt) : null,
      updatedAt: new Date(),
    };

    if (values.id) {
      await db
        .update(announcements)
        .set(record)
        .where(eq(announcements.id, values.id));
    } else {
      await db.insert(announcements).values(record);
    }

    revalidatePublic();
    return OK("Съобщението е запазено.");
  } catch (error) {
    console.error("saveAnnouncement:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteAnnouncement(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидно съобщение.");

    await db.delete(announcements).where(eq(announcements.id, id.data));

    revalidatePublic();
    return OK("Съобщението е изтрито.");
  } catch (error) {
    console.error("deleteAnnouncement:", error);
    return FAIL(describeError(error));
  }
}

/* ------------------------------------------------------------------ *
 * Gallery
 * ------------------------------------------------------------------ */

export async function uploadGalleryImages(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const files = formData
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) return FAIL("Моля, изберете поне една снимка.");

    const categoryId = String(formData.get("categoryId") ?? "");
    const caption = sanitizeText(String(formData.get("caption") ?? ""));

    let created = 0;
    const rejected: string[] = [];

    for (const file of files) {
      const result = await storeUploadedImage(file, "gallery");
      if (!result.ok) {
        rejected.push(`${result.originalName}: ${result.error}`);
        continue;
      }

      await db.insert(galleryItems).values({
        path: result.file.url,
        caption,
        categoryId: categoryId || null,
        sortOrder: 1000 + created,
      });
      created += 1;
    }

    revalidatePublic();

    if (rejected.length > 0 && created === 0) {
      return FAIL(`Нито една снимка не беше качена: ${rejected.join("; ")}`);
    }
    if (rejected.length > 0) {
      return FAIL(
        `Качени са ${created} снимки. Отхвърлени: ${rejected.join("; ")}`,
      );
    }
    return OK(`Качени са ${created} снимки.`);
  } catch (error) {
    console.error("uploadGalleryImages:", error);
    return FAIL(describeError(error));
  }
}

export async function updateGalleryItem(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = z
      .object({
        id: idSchema,
        caption: z.string().trim().max(200).optional().default(""),
        categoryId: z.string().trim().optional().default(""),
        sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
        isFeatured: z.boolean().default(false),
      })
      .safeParse({
        id: formData.get("id"),
        caption: formData.get("caption") ?? "",
        categoryId: formData.get("categoryId") ?? "",
        sortOrder: formData.get("sortOrder") ?? 0,
        isFeatured: formData.get("isFeatured") === "on",
      });

    if (!parsed.success) return FAIL("Невалидни данни.");

    await db
      .update(galleryItems)
      .set({
        caption: sanitizeText(parsed.data.caption),
        categoryId: parsed.data.categoryId || null,
        sortOrder: parsed.data.sortOrder,
        isFeatured: parsed.data.isFeatured,
      })
      .where(eq(galleryItems.id, parsed.data.id));

    revalidatePublic();
    return OK("Снимката е обновена.");
  } catch (error) {
    console.error("updateGalleryItem:", error);
    return FAIL(describeError(error));
  }
}

export async function archiveGalleryItem(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна снимка.");

    await db
      .update(galleryItems)
      .set({ archivedAt: new Date() })
      .where(eq(galleryItems.id, id.data));

    revalidatePublic();
    return OK("Снимката е скрита от галерията.");
  } catch (error) {
    console.error("archiveGalleryItem:", error);
    return FAIL(describeError(error));
  }
}

export async function restoreGalleryItem(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна снимка.");

    await db
      .update(galleryItems)
      .set({ archivedAt: null })
      .where(eq(galleryItems.id, id.data));

    revalidatePublic();
    return OK("Снимката е върната в галерията.");
  } catch (error) {
    console.error("restoreGalleryItem:", error);
    return FAIL(describeError(error));
  }
}

export async function deleteGalleryItem(
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = idSchema.safeParse(formData.get("id"));
    if (!id.success) return FAIL("Невалидна снимка.");

    const rows = await db
      .select()
      .from(galleryItems)
      .where(eq(galleryItems.id, id.data))
      .limit(1);

    const item = rows[0];
    if (!item) return FAIL("Снимката не е намерена.");

    await db.delete(galleryItems).where(eq(galleryItems.id, id.data));

    // The same file may illustrate a product; only an orphan is removed.
    await removeImageFileIfUnused(item.path);

    revalidatePublic();
    return OK("Снимката е изтрита окончателно.");
  } catch (error) {
    console.error("deleteGalleryItem:", error);
    return FAIL(describeError(error));
  }
}
