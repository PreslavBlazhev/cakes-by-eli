import { cache } from "react";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  announcements,
  scheduleExceptions,
  siteSettings,
  workingHours,
} from "@/db/schema";
import { todayInSofia } from "@/lib/format";
import { DEFAULT_WORKING_HOURS } from "@/lib/schedule";
import type { ScheduleExceptionRow, WorkingHourRow } from "@/lib/schedule";

export type SiteSettings = typeof siteSettings.$inferSelect;

/** Values used before the owner has saved anything — never invented facts. */
const FALLBACK: SiteSettings = {
  id: 1,
  businessName: "Cakes by ELI",
  tagline: "handcrafted sweets",
  phone: "",
  email: "",
  addressLine: "",
  city: "Плевен",
  mapsUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  topbarText: "",
  heroEyebrow: "",
  heroTitle: "",
  heroTitleAccent: "",
  heroSubtitle: "",
  aboutEyebrow: "",
  aboutTitle: "",
  aboutText: "",
  aboutQuote: "",
  contactIntro: "",
  orderDisclaimer:
    "Поръчката се счита за потвърдена след потвърждение от Cakes by ELI.",
  metaDescription: "",
  updatedAt: new Date(),
};

/**
 * Request-scoped memoisation.
 *
 * The site shell, the page and `generateMetadata` each need the settings, so a
 * single visit asked for them three or four times. `cache()` from React
 * deduplicates within one request and forgets everything at the end of it —
 * unlike a module-level cache, it never serves one visitor's read to another
 * and never keeps a row alive between requests.
 */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  return rows[0] ?? FALLBACK;
});

/** Request-scoped, like {@link getSettings} — the shell and the page both need it. */
export const getWorkingHours = cache(async (): Promise<WorkingHourRow[]> => {
  const rows = await db
    .select()
    .from(workingHours)
    .orderBy(asc(workingHours.weekday));

  if (rows.length === 0) return DEFAULT_WORKING_HOURS;

  return rows.map((r) => ({
    weekday: r.weekday,
    isClosed: r.isClosed,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
  }));
});

/**
 * Exceptions from today onwards — the public site never shows past ones.
 * Request-scoped, like {@link getSettings}; memoised per `days` argument.
 */
export const getUpcomingExceptions = cache(async (
  days = 120,
): Promise<ScheduleExceptionRow[]> => {
  const today = todayInSofia();
  const rows = await db
    .select()
    .from(scheduleExceptions)
    .where(gte(scheduleExceptions.date, today))
    .orderBy(asc(scheduleExceptions.date))
    .limit(days);

  return rows.map(toExceptionRow);
});

export async function getAllExceptions(): Promise<
  (ScheduleExceptionRow & { id: string })[]
> {
  const rows = await db
    .select()
    .from(scheduleExceptions)
    .orderBy(asc(scheduleExceptions.date));
  return rows.map((r) => ({ ...toExceptionRow(r), id: r.id }));
}

function toExceptionRow(
  r: typeof scheduleExceptions.$inferSelect,
): ScheduleExceptionRow {
  return {
    date: r.date,
    isClosed: r.isClosed,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
    blocksOrders: r.blocksOrders,
    note: r.note,
  };
}

export type Announcement = typeof announcements.$inferSelect;

/**
 * The single banner currently in force, if any.
 * Request-scoped, like {@link getSettings}.
 */
export const getActiveAnnouncement = cache(async (): Promise<Announcement | null> => {
  const now = new Date();
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.isActive, true),
        or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
        or(isNull(announcements.endsAt), gte(announcements.endsAt, now)),
      ),
    )
    .orderBy(asc(announcements.createdAt))
    .limit(1);

  return rows[0] ?? null;
});

export async function listAnnouncements(): Promise<Announcement[]> {
  return db.select().from(announcements).orderBy(asc(announcements.createdAt));
}
