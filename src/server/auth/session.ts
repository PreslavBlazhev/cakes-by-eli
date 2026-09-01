import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { adminSessions, adminUsers, loginAttempts } from "@/db/schema";
import { env, isProduction } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Admin authentication.
 *
 * The credentials are the plain `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the
 * environment, compared directly against what the login form submits — the
 * database stores no password at all. Whoever can read the environment can
 * therefore sign in, so those variables are the secret to protect.
 *
 * The session that follows is unchanged: the cookie holds a 32-byte random
 * token and only its SHA-256 digest is stored, so the session table is not a
 * source of usable credentials. Sessions are revocable, expire server-side,
 * and the cookie is HTTP-only, SameSite=Lax and Secure in production.
 */

export const SESSION_COOKIE = "cbe_admin_session";

export type AdminIdentity = {
  id: string;
  email: string;
  name: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ------------------------------------------------------------------ *
 * Login
 * ------------------------------------------------------------------ */

export type LoginOutcome =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

export async function login(
  email: string,
  password: string,
): Promise<LoginOutcome> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";

  const normalizedEmail = email.trim().toLowerCase();

  // Two independent windows: one per source address, one per account, so a
  // distributed guess against one account is throttled too.
  const byIp = rateLimit(`login:ip:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
  const byAccount = rateLimit(`login:acct:${normalizedEmail}`, {
    limit: 8,
    windowMs: 15 * 60_000,
  });

  if (!byIp.allowed || !byAccount.allowed) {
    await recordAttempt(`${ip}|${normalizedEmail}`, false);
    return {
      ok: false,
      message:
        "Твърде много неуспешни опити. Моля, изчакайте и опитайте отново.",
      retryAfterSeconds: Math.max(
        byIp.retryAfterSeconds,
        byAccount.retryAfterSeconds,
      ),
    };
  }

  const adminEmail = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    // A deployment without credentials must fail loudly in the log and
    // silently in the browser — never hint at which half is missing, and
    // never print either value.
    console.error(
      "Конфигурационна грешка: ADMIN_EMAIL и/или ADMIN_PASSWORD липсват в средата. " +
        "Вход в административния панел е невъзможен, докато не бъдат зададени.",
    );
    await recordAttempt(`${ip}|${normalizedEmail}`, false);
    return { ok: false, message: "Грешен имейл или парола." };
  }

  // Both halves are always compared, so a wrong e-mail and a wrong password
  // take the same time and reveal nothing about which one was wrong.
  const emailMatches = safeEquals(
    normalizedEmail,
    adminEmail.trim().toLowerCase(),
  );
  const passwordMatches = safeEquals(password, adminPassword);

  if (!emailMatches || !passwordMatches) {
    await recordAttempt(`${ip}|${normalizedEmail}`, false);
    return { ok: false, message: "Грешен имейл или парола." };
  }

  const user = await ensureAdminUser(adminEmail);

  await recordAttempt(`${ip}|${normalizedEmail}`, true);
  await createSession(user.id, headerList.get("user-agent"));

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, user.id));

  return { ok: true };
}

/**
 * The credentials live in the environment, but the row does not go away: a
 * session, an order note and an audit entry all point at an admin id. So the
 * account is materialised on first successful login and reused afterwards.
 */
async function ensureAdminUser(email: string): Promise<{ id: string }> {
  const normalized = email.trim().toLowerCase();

  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${normalized}`)
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(adminUsers)
    .values({ email: email.trim(), name: env.ADMIN_NAME ?? "Администратор" })
    .returning({ id: adminUsers.id });

  return created;
}

async function recordAttempt(bucket: string, succeeded: boolean) {
  try {
    await db.insert(loginAttempts).values({ bucket, succeeded });
    // Keep the audit trail bounded.
    await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.attemptedAt, new Date(Date.now() - 30 * 86_400_000)));
  } catch (error) {
    console.error("Неуспешен запис на опит за вход:", error);
  }
}

async function createSession(adminId: string, userAgent: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600_000);

  await db.insert(adminSessions).values({
    adminId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: userAgent?.slice(0, 250) ?? null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires: expiresAt,
  });
}

/* ------------------------------------------------------------------ *
 * Session lookup
 * ------------------------------------------------------------------ */

export async function currentAdmin(): Promise<AdminIdentity | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);

  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      sessionId: adminSessions.id,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, email: row.email, name: row.name };
}

/**
 * Guard for every admin server action and page.
 *
 * Hiding a link is not authorisation — this must be called on the server
 * before any privileged read or write.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin) {
    throw new Error("UNAUTHORIZED");
  }
  return admin;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, hashToken(token)));
  }

  store.delete(SESSION_COOKIE);
}

/** Removes expired sessions; called opportunistically from the dashboard. */
export async function pruneSessions(): Promise<void> {
  try {
    await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  } catch (error) {
    console.error("Неуспешно почистване на сесии:", error);
  }
}

/** Constant-time comparison helper for tokens supplied in URLs. */
export function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
