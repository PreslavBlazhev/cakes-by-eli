import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The limiter's keys are partly attacker-chosen — a client address for the
 * lookup endpoint, a submitted e-mail address for the login form — so its map
 * needs a hard ceiling, not just the periodic sweep. The sweep only runs when a
 * request arrives, and only removes what has already expired; a flood of
 * distinct keys inside one window slipped straight past it.
 */

type RateLimit = typeof import("@/lib/rate-limit");

let limiter: RateLimit;

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  limiter = await import("@/lib/rate-limit");
});

const WINDOW = { limit: 5, windowMs: 60_000 };

describe("throttling behaviour", () => {
  it("allows up to the limit and then refuses", async () => {
    for (let i = 0; i < WINDOW.limit; i += 1) {
      expect(limiter.rateLimit("a", WINDOW).allowed).toBe(true);
    }

    const blocked = limiter.rateLimit("a", WINDOW);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key separately", async () => {
    for (let i = 0; i < WINDOW.limit + 1; i += 1) limiter.rateLimit("a", WINDOW);
    expect(limiter.rateLimit("b", WINDOW).allowed).toBe(true);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < WINDOW.limit + 1; i += 1) limiter.rateLimit("a", WINDOW);
    expect(limiter.rateLimit("a", WINDOW).allowed).toBe(false);

    clock.mockReturnValue(now + WINDOW.windowMs + 1);
    expect(limiter.rateLimit("a", WINDOW).allowed).toBe(true);

    clock.mockRestore();
  });

  it("resetRateLimit forgets a single key", async () => {
    for (let i = 0; i < WINDOW.limit + 1; i += 1) limiter.rateLimit("a", WINDOW);
    expect(limiter.rateLimit("a", WINDOW).allowed).toBe(false);

    limiter.resetRateLimit("a");
    expect(limiter.rateLimit("a", WINDOW).allowed).toBe(true);
  });
});

describe("hard ceiling", () => {
  it("never tracks more keys than the ceiling, however many arrive", async () => {
    const ceiling = limiter.MAX_TRACKED_KEYS;

    // A long window, so nothing expires and the sweep cannot help — this is
    // exactly the case the ceiling exists for.
    const wide = { limit: 5, windowMs: 60 * 60 * 1000 };
    for (let i = 0; i < ceiling + 500; i += 1) {
      limiter.rateLimit(`flood:${i}`, wide);
    }

    expect(limiter.trackedKeyCount()).toBeLessThanOrEqual(ceiling);
    expect(limiter.trackedKeyCount()).toBeGreaterThan(0);
  });

  it("drops expired keys before touching live ones", async () => {
    const ceiling = limiter.MAX_TRACKED_KEYS;
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);

    // Fill it up with keys on a short window.
    const short = { limit: 5, windowMs: 1_000 };
    for (let i = 0; i < ceiling; i += 1) limiter.rateLimit(`old:${i}`, short);
    expect(limiter.trackedKeyCount()).toBe(ceiling);

    // Everything above is now expired. One more key must reclaim that space
    // rather than evicting anything that is still in force.
    clock.mockReturnValue(now + 2_000);
    limiter.rateLimit("fresh", { limit: 5, windowMs: 60 * 60 * 1000 });

    // Every one of those keys had expired, so the ceiling pass reclaims all of
    // them in one go instead of freeing a single slot at a time.
    expect(limiter.trackedKeyCount()).toBeLessThan(ceiling / 2);
    expect(limiter.rateLimit("fresh", { limit: 5, windowMs: 60 * 60 * 1000 })
      .remaining).toBe(3);

    clock.mockRestore();
  });

  it("evicts the oldest surviving keys when nothing has expired", async () => {
    const ceiling = limiter.MAX_TRACKED_KEYS;
    const wide = { limit: 5, windowMs: 60 * 60 * 1000 };

    // The first key seen is the first to go once the map is full of live keys.
    limiter.rateLimit("first", wide);
    limiter.rateLimit("first", wide);
    expect(limiter.rateLimit("first", wide).remaining).toBe(wide.limit - 3);

    for (let i = 0; i < ceiling + 10; i += 1) limiter.rateLimit(`k:${i}`, wide);

    expect(limiter.trackedKeyCount()).toBeLessThanOrEqual(ceiling);
    // Evicted, so it gets a full fresh allowance rather than its old count.
    expect(limiter.rateLimit("first", wide).remaining).toBe(wide.limit - 1);
  });

  it("does not rescan the whole map on every insertion once it is full", async () => {
    // A flood of live keys must stay cheap: reclaiming down to a low-water mark
    // means the O(n) pass happens once per tenth of the ceiling, not once per
    // key. On half a CPU the naive version is itself a denial of service.
    const ceiling = limiter.MAX_TRACKED_KEYS;
    const wide = { limit: 5, windowMs: 60 * 60 * 1000 };

    for (let i = 0; i < ceiling; i += 1) limiter.rateLimit(`fill:${i}`, wide);

    const started = Date.now();
    for (let i = 0; i < 5_000; i += 1) limiter.rateLimit(`flood:${i}`, wide);
    const elapsed = Date.now() - started;

    expect(limiter.trackedKeyCount()).toBeLessThanOrEqual(ceiling);
    // Generous, but a per-insertion full scan here is ~5 × 10^7 map steps and
    // does not finish anywhere near this fast.
    expect(elapsed).toBeLessThan(2_000);
  });
});

describe("clientKey", () => {
  it("prefers the first forwarded address and prefixes the bucket", async () => {
    const key = limiter.clientKey(
      new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
      "econt-lookup",
    );
    expect(key).toBe("econt-lookup:203.0.113.7");
  });

  it("falls back to x-real-ip and then to a constant", async () => {
    expect(
      limiter.clientKey(new Headers({ "x-real-ip": "198.51.100.4" }), "login"),
    ).toBe("login:198.51.100.4");
    expect(limiter.clientKey(new Headers(), "login")).toBe("login:unknown");
  });
});
