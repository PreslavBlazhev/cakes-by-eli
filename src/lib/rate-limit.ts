/**
 * Small in-process rate limiter.
 *
 * Deliberately simple: this application is a single modular monolith, so a
 * Redis dependency would be unjustified. If it is ever deployed behind
 * multiple instances, swap the Map for a shared store — the call sites do not
 * change.
 *
 * Keys are partly attacker-chosen — a client address for the lookup endpoint,
 * a submitted e-mail address for the login form — so the map has a hard
 * ceiling as well as the periodic sweep. The sweep alone was not enough: it
 * only runs when a request arrives, and only removes what has already expired.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Absolute ceiling on tracked keys.
 *
 * A bucket is a small object plus its key, on the order of a hundred bytes, so
 * this bounds the limiter at roughly a megabyte. It is far above anything real
 * traffic produces — the sweep keeps the steady state in the dozens — and only
 * a deliberate flood of distinct keys ever reaches it.
 */
export const MAX_TRACKED_KEYS = 10_000;

let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Reclaiming stops here rather than at the ceiling itself.
 *
 * Freeing exactly one slot per insertion would mean a full scan on *every*
 * request once the map is full — an O(n) walk per key, which on half a CPU is
 * itself a denial of service. Clearing down to a low-water mark amortises that
 * walk over the next tenth of the ceiling's worth of keys.
 */
const CEILING_LOW_WATER = Math.floor(MAX_TRACKED_KEYS * 0.9);

/**
 * Makes room for more keys once the ceiling is reached.
 *
 * Expired buckets go first — dropping those costs nothing, because they were
 * about to be reset anyway, and in practice a flood of distinct keys is almost
 * entirely expired by the time it matters. Only if that is not enough does it
 * fall back to evicting the keys seen longest ago, which is the one case where
 * a flood can cost an honest client its remaining allowance.
 */
function enforceCeiling(now: number) {
  if (buckets.size < MAX_TRACKED_KEYS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size <= CEILING_LOW_WATER) return;

  // Insertion order, so the first keys are the ones seen longest ago.
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (buckets.size <= CEILING_LOW_WATER) return;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (!existing) enforceCeiling(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Number of keys currently tracked. For tests and diagnostics. */
export function trackedKeyCount(): number {
  return buckets.size;
}

/** Best-effort client identity for throttling, from proxy headers. */
export function clientKey(headers: Headers, prefix: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}
