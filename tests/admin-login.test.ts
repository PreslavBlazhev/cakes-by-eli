import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin credentials are the plain ADMIN_EMAIL and ADMIN_PASSWORD from the
 * environment — the database stores no password. This exercises the whole
 * login against a throwaway PGlite: what is accepted, what is refused, and
 * what happens to a deployment that forgot to set the variables.
 *
 * Only the two Next request helpers are stubbed; the rate limiter, the session
 * table and the account row are real.
 */

const tmpDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cbe-login-")), "pglite");

process.env.PGLITE_DIR = tmpDir;
process.env.DATABASE_URL = "";
process.env.APP_URL = "http://localhost:3000";

const ADMIN_EMAIL = "eli@cakesbyeli.bg";
const ADMIN_PASSWORD = "паролата-в-чист-вид";

/** Flipped per test, so the "not configured" branch is reachable. */
let adminEmail: string | undefined = ADMIN_EMAIL;
let adminPassword: string | undefined = ADMIN_PASSWORD;

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get(target, property) {
        if (property === "ADMIN_EMAIL") return adminEmail;
        if (property === "ADMIN_PASSWORD") return adminPassword;
        return Reflect.get(target, property);
      },
    }),
  };
});

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

type Db = Awaited<typeof import("@/db/client")>["db"];
type Schema = typeof import("@/db/schema");
type Session = typeof import("@/server/auth/session");

let db: Db;
let schema: Schema;
let session: Session;
let resetRateLimit: typeof import("@/lib/rate-limit")["resetRateLimit"];

beforeAll(async () => {
  const client = await import("@/db/client");
  db = client.db;
  schema = await import("@/db/schema");

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  session = await import("@/server/auth/session");
  ({ resetRateLimit } = await import("@/lib/rate-limit"));
}, 120_000);

beforeEach(() => {
  adminEmail = ADMIN_EMAIL;
  adminPassword = ADMIN_PASSWORD;
  cookieJar.clear();
  // Each test starts with a full allowance; the limiter is process-wide.
  resetRateLimit("login:ip:203.0.113.7");
  resetRateLimit(`login:acct:${ADMIN_EMAIL}`);
  resetRateLimit("login:acct:someone@else.bg");
});

afterAll(() => {
  // PGlite may still hold file handles on Windows; a leftover temp directory
  // must never fail the suite.
  try {
    fs.rmSync(path.dirname(tmpDir), { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("signing in with the environment credentials", () => {
  it("accepts the exact e-mail and password and starts a session", async () => {
    const result = await session.login(ADMIN_EMAIL, ADMIN_PASSWORD);

    expect(result.ok).toBe(true);
    expect(cookieJar.get(session.SESSION_COOKIE)).toBeTruthy();
    await expect(session.currentAdmin()).resolves.toMatchObject({
      email: ADMIN_EMAIL,
    });
  });

  it("ignores the case of the e-mail", async () => {
    const result = await session.login("ELI@CakesByEli.BG", ADMIN_PASSWORD);
    expect(result.ok).toBe(true);
  });

  it("refuses a wrong password", async () => {
    const result = await session.login(ADMIN_EMAIL, ADMIN_PASSWORD + "!");

    expect(result.ok).toBe(false);
    expect(cookieJar.get(session.SESSION_COOKIE)).toBeUndefined();
  });

  it("refuses an unknown e-mail", async () => {
    const result = await session.login("someone@else.bg", ADMIN_PASSWORD);

    expect(result.ok).toBe(false);
    expect(cookieJar.get(session.SESSION_COOKIE)).toBeUndefined();
  });

  it("says the same thing whichever half is wrong", async () => {
    const wrongPassword = await session.login(ADMIN_EMAIL, "nope");
    const wrongEmail = await session.login("someone@else.bg", ADMIN_PASSWORD);

    expect(wrongPassword.ok).toBe(false);
    expect(wrongEmail.ok).toBe(false);
    expect(wrongPassword).toEqual(wrongEmail);
  });
});

describe("the account row", () => {
  it("is created once and reused on later logins", async () => {
    await session.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cookieJar.clear();
    await session.login(ADMIN_EMAIL, ADMIN_PASSWORD);

    const rows = await db
      .select({ id: schema.adminUsers.id })
      .from(schema.adminUsers);

    expect(rows).toHaveLength(1);
  });

  it("stores no password of any kind", async () => {
    await session.login(ADMIN_EMAIL, ADMIN_PASSWORD);

    const [row] = await db.select().from(schema.adminUsers);
    expect(Object.keys(row)).not.toContain("passwordHash");
    expect(JSON.stringify(row)).not.toContain(ADMIN_PASSWORD);
  });
});

describe("a deployment with the variables missing", () => {
  it("refuses the login and reports the gap in the server log", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    adminPassword = undefined;

    const result = await session.login(ADMIN_EMAIL, ADMIN_PASSWORD);

    expect(result.ok).toBe(false);
    expect(cookieJar.get(session.SESSION_COOKIE)).toBeUndefined();

    const message = logged.mock.calls.flat().join(" ");
    expect(message).toContain("ADMIN_PASSWORD");
    // The log must never carry the values themselves.
    expect(message).not.toContain(ADMIN_PASSWORD);

    logged.mockRestore();
  });

  it("is surfaced in the admin panel's configuration warnings", async () => {
    const { configurationWarnings } = await import("@/lib/env");
    adminEmail = undefined;
    adminPassword = undefined;

    expect(configurationWarnings().join(" ")).toContain("ADMIN_EMAIL");
  });
});
