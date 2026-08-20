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

export async function getSettings(): Promise<SiteSettings> {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  return rows[0] ?? FALLBACK;
}

export async function getWorkingHours(): Promise<WorkingHourRow[]> {
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
}

/** Exceptions from today onwards — the public site never shows past ones. */
export async function getUpcomingExceptions(
  days = 120,
): Promise<ScheduleExceptionRow[]> {
  const today = todayInSofia();
  const rows = await db
    .select()
    .from(scheduleExceptions)
    .where(gte(scheduleExceptions.date, today))
    .orderBy(asc(scheduleExceptions.date))
    .limit(days);

  return rows.map(toExceptionRow);
}

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

/** The single banner currently in force, if any. */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
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
}

export async function listAnnouncements(): Promise<Announcement[]> {
  return db.select().from(announcements).orderBy(asc(announcements.createdAt));
}
