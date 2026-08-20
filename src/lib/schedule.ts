import {
  isoWeekdayInSofia,
  shortTime,
  timeInSofia,
  todayInSofia,
} from "@/lib/format";
import { WEEKDAY_LABELS } from "@/lib/labels";

export type WorkingHourRow = {
  weekday: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

export type ScheduleExceptionRow = {
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  blocksOrders: boolean;
  note: string;
};

export type DayStatus = {
  /** `YYYY-MM-DD` in Europe/Sofia. */
  date: string;
  weekday: number;
  weekdayLabel: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  /** Set when the day is governed by an exception rather than the weekly plan. */
  exceptionNote: string | null;
  isException: boolean;
};

/**
 * Resolves the effective opening hours for one calendar date: an exception for
 * that exact date always wins over the weekly plan.
 */
export function resolveDay(
  date: string,
  hours: WorkingHourRow[],
  exceptions: ScheduleExceptionRow[],
): DayStatus {
  const weekday = isoWeekdayFromIsoDate(date);
  const exception = exceptions.find((e) => e.date === date);

  if (exception) {
    return {
      date,
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday] ?? "",
      isClosed: exception.isClosed,
      opensAt: shortTime(exception.opensAt) || null,
      closesAt: shortTime(exception.closesAt) || null,
      exceptionNote: exception.note || null,
      isException: true,
    };
  }

  const row = hours.find((h) => h.weekday === weekday);
  return {
    date,
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday] ?? "",
    isClosed: row?.isClosed ?? true,
    opensAt: shortTime(row?.opensAt) || null,
    closesAt: shortTime(row?.closesAt) || null,
    exceptionNote: null,
    isException: false,
  };
}

/** Short public sentence such as „Днес работим до 14:00“. */
export function todayStatusSentence(
  hours: WorkingHourRow[],
  exceptions: ScheduleExceptionRow[],
  now: Date = new Date(),
): { text: string; isOpen: boolean; note: string | null } {
  const today = resolveDay(todayInSofia(now), hours, exceptions);
  const note = today.exceptionNote;

  if (today.isClosed || !today.opensAt || !today.closesAt) {
    return { text: "Днес не работим", isOpen: false, note };
  }

  const current = timeInSofia(now);
  if (current < today.opensAt) {
    return {
      text: `Днес отваряме в ${today.opensAt}`,
      isOpen: false,
      note,
    };
  }
  if (current >= today.closesAt) {
    return { text: "Днес вече затворихме", isOpen: false, note };
  }
  return { text: `Днес работим до ${today.closesAt}`, isOpen: true, note };
}

/** ISO weekday (1 = Monday) for a `YYYY-MM-DD` calendar date. */
export function isoWeekdayFromIsoDate(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoWeekdayInSofia();
  const js = d.getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/** Dates the owner has explicitly closed for new orders. */
export function isDateBlockedForOrders(
  date: string,
  exceptions: ScheduleExceptionRow[],
): { blocked: boolean; reason: string | null } {
  const exception = exceptions.find((e) => e.date === date);
  if (!exception) return { blocked: false, reason: null };
  if (!exception.blocksOrders) return { blocked: false, reason: null };
  return {
    blocked: true,
    reason:
      exception.note ||
      "За тази дата не се приемат поръчки. Моля, изберете друга.",
  };
}

export const DEFAULT_WORKING_HOURS: WorkingHourRow[] = [1, 2, 3, 4, 5, 6, 7].map(
  (weekday) => ({
    weekday,
    isClosed: weekday === 7,
    opensAt: weekday === 7 ? null : weekday === 6 ? "10:00:00" : "09:00:00",
    closesAt: weekday === 7 ? null : weekday === 6 ? "14:00:00" : "18:00:00",
  }),
);
