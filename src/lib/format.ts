export const TIMEZONE = "Europe/Sofia";

/* ------------------------------------------------------------------ *
 * Money — stored as integer minor units (cents) in EUR.
 * ------------------------------------------------------------------ */

const eurFormatter = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatPrice(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return null;
  }
  return eurFormatter.format(cents / 100);
}

/** Falls back to the agreed Bulgarian wording when no price is configured. */
export function formatPriceOrPending(cents: number | null | undefined): string {
  return formatPrice(cents) ?? "Цена след уточнение";
}

export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/* ------------------------------------------------------------------ *
 * Dates — always presented in Europe/Sofia regardless of server locale.
 * ------------------------------------------------------------------ */

const dateFormatter = new Intl.DateTimeFormat("bg-BG", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("bg-BG", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("bg-BG", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? dateFormatter.format(d) : "—";
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFormatter.format(d) : "—";
}

export function formatLongDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? longDateFormatter.format(d) : "—";
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Bare `YYYY-MM-DD` values are calendar dates: anchoring them at noon UTC
  // keeps them on the same day in Europe/Sofia no matter the offset.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today's calendar date in Europe/Sofia, as `YYYY-MM-DD`. */
export function todayInSofia(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** ISO weekday in Europe/Sofia: 1 = Monday … 7 = Sunday. */
export function isoWeekdayInSofia(now: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[name] ?? 1;
}

/** Current wall-clock time in Europe/Sofia as `HH:MM`. */
export function timeInSofia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Trims a Postgres `time` value (`09:00:00`) down to `09:00`. */
export function shortTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

/* ------------------------------------------------------------------ *
 * Phone numbers
 * ------------------------------------------------------------------ */

/**
 * Normalises Bulgarian mobile/landline input to E.164 so two spellings of the
 * same number stay comparable. Returns null when the input cannot be a valid
 * Bulgarian number.
 */
export function normalizeBgPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (!digits) return null;

  let rest: string;
  if (digits.startsWith("+359")) rest = digits.slice(4);
  else if (digits.startsWith("00359")) rest = digits.slice(5);
  else if (digits.startsWith("359")) rest = digits.slice(3);
  else if (digits.startsWith("0")) rest = digits.slice(1);
  else rest = digits;

  rest = rest.replace(/\D/g, "");
  if (rest.length < 8 || rest.length > 9) return null;

  return `+359${rest}`;
}

/** Presentation form: `087 857 6728`. */
export function formatBgPhone(e164: string): string {
  const rest = e164.startsWith("+359") ? e164.slice(4) : e164;
  if (rest.length === 9) {
    return `0${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }
  return `0${rest}`;
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function pluralBg(
  count: number,
  one: string,
  many: string,
): string {
  return `${count} ${count === 1 ? one : many}`;
}
