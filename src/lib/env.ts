import { z } from "zod";

/**
 * Environment contract.
 *
 * Nothing here throws at import time for optional integrations — a missing
 * e-mail or Econt credential must degrade to a clearly reported "not
 * configured" state rather than crash the whole site. Only genuinely
 * load-bearing values are validated strictly.
 */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Absolute public origin, used for e-mail links, QR codes and metadata. */
  APP_URL: z
    .string()
    .trim()
    .default("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),

  /**
   * PostgreSQL connection string. When empty the app falls back to an
   * embedded PGlite database (real PostgreSQL, no server) under PGLITE_DIR,
   * which is intended for local development and automated tests only.
   */
  DATABASE_URL: optionalString,
  PGLITE_DIR: z.string().trim().default(".data/pglite"),

  /** 32+ byte secret used to sign the admin session cookie. */
  SESSION_SECRET: optionalString,
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),

  /**
   * The admin credentials, in plain text. Both are compared directly against
   * what the login form submits, so they are the whole of the admin account:
   * without them nobody can sign in.
   */
  ADMIN_EMAIL: optionalString,
  ADMIN_PASSWORD: optionalString,
  ADMIN_NAME: optionalString,

  /** E-mail delivery. `console` writes to the server log instead of sending. */
  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  EMAIL_FROM: optionalString,
  EMAIL_API_KEY: optionalString,
  SMTP_URL: optionalString,
  OWNER_NOTIFICATION_EMAIL: optionalString,

  /** File storage. `local` writes under public/uploads. */
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().trim().default("public/uploads"),
  STORAGE_PUBLIC_PREFIX: z.string().trim().default("/uploads"),
  S3_ENDPOINT: optionalString,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_PUBLIC_BASE_URL: optionalString,

  /** Econt Delivery API. */
  ECONT_ENVIRONMENT: z.enum(["demo", "production"]).default("demo"),
  ECONT_USERNAME: optionalString,
  ECONT_PASSWORD: optionalString,
  ECONT_SENDER_NAME: optionalString,
  ECONT_SENDER_PHONE: optionalString,
  ECONT_SENDER_AGENT_NAME: optionalString,
  ECONT_SENDER_CITY_ID: z.coerce.number().int().optional(),
  ECONT_SENDER_CITY_NAME: optionalString,
  ECONT_SENDER_POST_CODE: optionalString,
  ECONT_SENDER_QUARTER: optionalString,
  ECONT_SENDER_STREET: optionalString,
  ECONT_SENDER_STREET_NUM: optionalString,
  ECONT_SENDER_OTHER: optionalString,
  ECONT_SENDER_OFFICE_CODE: optionalString,

  /**
   * Upload limits (server-enforced, and the single source of truth for the
   * numbers the order form shows). Both must stay within
   * SERVER_ACTION_BODY_LIMIT_MB — see the refinement below.
   */
  UPLOAD_MAX_FILE_MB: z.coerce.number().min(1).max(10).default(3),
  UPLOAD_MAX_FILES: z.coerce.number().int().min(1).max(10).default(3),
});

/**
 * Must equal `experimental.serverActions.bodySizeLimit` in `next.config.ts`.
 *
 * Next buffers the whole multipart body before a server action runs, so the
 * upload limits above have to fit inside it with room for the field data and
 * the multipart framing. `tests/upload-limits.test.ts` asserts that the two
 * files agree, so this constant cannot drift unnoticed.
 */
export const SERVER_ACTION_BODY_LIMIT_MB = 12;

/** Headroom left for form fields and multipart boundaries. */
const BODY_LIMIT_MARGIN_MB = 2;

export type Env = z.infer<typeof schema>;

/**
 * The largest multipart body the upload limits can produce, in MB.
 *
 * Exported so the limits can be checked without booting the whole module.
 */
export function worstCaseUploadBodyMb(
  maxFiles: number,
  maxFileMb: number,
): number {
  return maxFiles * maxFileMb + BODY_LIMIT_MARGIN_MB;
}

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Невалидна конфигурация на средата:\n${details}`);
  }

  const { UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_MB } = parsed.data;
  const worstCase = worstCaseUploadBodyMb(UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_MB);

  if (worstCase > SERVER_ACTION_BODY_LIMIT_MB) {
    // Caught at boot rather than as an opaque "body exceeded" error the first
    // time a customer attaches a full set of photos.
    throw new Error(
      "Невалидна конфигурация на средата:\n" +
        `  - UPLOAD_MAX_FILES × UPLOAD_MAX_FILE_MB (${UPLOAD_MAX_FILES} × ` +
        `${UPLOAD_MAX_FILE_MB} MB = ${worstCase} MB с резерв) надхвърля ` +
        `serverActions.bodySizeLimit (${SERVER_ACTION_BODY_LIMIT_MB} MB) от next.config.ts.`,
    );
  }

  return parsed.data;
}

export const env: Env = load();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** True when a real PostgreSQL server is configured. */
export const usesPostgresServer = Boolean(env.DATABASE_URL);

/**
 * Session signing key. In development a stable derived fallback keeps the DX
 * friction-free; in production the secret is mandatory.
 */
export function sessionSecret(): Uint8Array {
  const raw = env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    if (isProduction) {
      throw new Error(
        "SESSION_SECRET липсва или е по-къс от 32 знака. Задайте го преди стартиране в продукция.",
      );
    }
    return new TextEncoder().encode(
      "development-only-insecure-session-secret-cakes-by-eli",
    );
  }
  return new TextEncoder().encode(raw);
}

/**
 * What is missing for Econt to accept this business as the sender.
 *
 * A shipment leaves either from an Econt office (ECONT_SENDER_OFFICE_CODE) or
 * is collected from an address, which needs a nomenclature city plus enough
 * of a street address for the courier to find it. Either one is sufficient;
 * neither is a real gap, not something to hide. Whether an office code
 * actually exists is checked against the live nomenclature on the order page.
 */
export function econtSenderGaps(source: Env = env): string[] {
  const out: string[] = [];
  if (!source.ECONT_SENDER_NAME || !source.ECONT_SENDER_PHONE) {
    out.push(
      "ECONT_SENDER_NAME / ECONT_SENDER_PHONE липсват — подателят за Еконт не е конфигуриран.",
    );
  }
  if (source.ECONT_SENDER_OFFICE_CODE) return out;

  if (!source.ECONT_SENDER_CITY_ID || !source.ECONT_SENDER_CITY_NAME) {
    out.push(
      "Мястото на изпращане за Еконт не е конфигурирано — задайте ECONT_SENDER_OFFICE_CODE " +
        "(изпращане от офис) или ECONT_SENDER_CITY_ID и ECONT_SENDER_CITY_NAME с адрес (вземане от адрес).",
    );
  } else if (
    !(source.ECONT_SENDER_STREET && source.ECONT_SENDER_STREET_NUM) &&
    !(source.ECONT_SENDER_QUARTER && source.ECONT_SENDER_OTHER)
  ) {
    out.push(
      "Адресът на подателя за Еконт е непълен — нужни са ECONT_SENDER_STREET и ECONT_SENDER_STREET_NUM " +
        "(или ECONT_SENDER_QUARTER и ECONT_SENDER_OTHER), или ECONT_SENDER_OFFICE_CODE за изпращане от офис.",
    );
  }
  return out;
}

/** Configuration gaps the admin UI surfaces instead of failing silently. */
export function configurationWarnings(): string[] {
  const out: string[] = [];
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    out.push(
      "ADMIN_EMAIL / ADMIN_PASSWORD липсват — вход в административния панел е невъзможен.",
    );
  }
  if (!env.OWNER_NOTIFICATION_EMAIL) {
    out.push(
      "OWNER_NOTIFICATION_EMAIL не е зададен — известията за нови поръчки няма къде да се изпратят.",
    );
  }
  if (env.EMAIL_PROVIDER === "console") {
    out.push(
      "EMAIL_PROVIDER е „console“ — писмата се записват в лога, но не се изпращат реално.",
    );
  }
  if (env.EMAIL_PROVIDER === "resend" && !env.EMAIL_API_KEY) {
    out.push("EMAIL_API_KEY липсва при избран доставчик Resend.");
  }
  if (env.EMAIL_PROVIDER !== "console" && !env.EMAIL_FROM) {
    out.push("EMAIL_FROM липсва — писмата не могат да бъдат изпратени.");
  }
  if (env.EMAIL_PROVIDER === "smtp") {
    out.push(
      "EMAIL_PROVIDER е „smtp“, но SMTP изпращането не е реализирано — използвайте „resend“.",
    );
  }
  if (!env.ECONT_USERNAME || !env.ECONT_PASSWORD) {
    out.push(
      "ECONT_USERNAME / ECONT_PASSWORD липсват — товарителници не могат да се създават.",
    );
  }
  for (const gap of econtSenderGaps()) out.push(gap);
  if (isProduction && !env.DATABASE_URL) {
    out.push(
      "DATABASE_URL липсва в продукция — вградената PGlite база не е подходяща за реален сайт.",
    );
  }
  return out;
}
