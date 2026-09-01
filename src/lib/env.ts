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

  /** Upload limits (server-enforced). */
  UPLOAD_MAX_FILE_MB: z.coerce.number().min(1).max(25).default(6),
  UPLOAD_MAX_FILES: z.coerce.number().int().min(1).max(20).default(5),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Невалидна конфигурация на средата:\n${details}`);
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
  if (!env.ECONT_USERNAME || !env.ECONT_PASSWORD) {
    out.push(
      "ECONT_USERNAME / ECONT_PASSWORD липсват — товарителници не могат да се създават.",
    );
  }
  if (!env.ECONT_SENDER_CITY_ID) {
    out.push(
      "ECONT_SENDER_CITY_ID липсва — адресът на подателя за Еконт не е конфигуриран.",
    );
  }
  if (isProduction && !env.DATABASE_URL) {
    out.push(
      "DATABASE_URL липсва в продукция — вградената PGlite база не е подходяща за реален сайт.",
    );
  }
  return out;
}
