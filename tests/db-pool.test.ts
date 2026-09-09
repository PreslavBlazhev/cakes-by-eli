import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `pg.Pool` is an EventEmitter that emits `'error'` when an *idle* client dies —
 * a database restart, an expired TCP idle, a network blip. An EventEmitter with
 * no listener for `'error'` throws, which takes the whole Node process down.
 *
 * On Render that death looks exactly like an out-of-memory kill in the Events
 * list, which is why it mattered for the OOM investigation as well as for
 * stability: without the listener, some share of the crashes may never have
 * been about memory at all.
 *
 * The pool is a singleton pinned to `globalThis`, so the listener has to be
 * attached where the pool is constructed and nowhere else — one listener per
 * pool, not one per query.
 */

type PoolConfig = Record<string, unknown>;

const constructed: PoolConfig[] = [];
const listeners: { event: string; handler: (error: Error) => void }[] = [];

class FakePool {
  readonly options: PoolConfig;

  constructor(options: PoolConfig) {
    this.options = options;
    constructed.push(options);
  }

  on(event: string, handler: (error: Error) => void): this {
    listeners.push({ event, handler });
    return this;
  }

  async query() {
    throw new Error("the pool must not be queried in this test");
  }

  async connect() {
    throw new Error("the pool must not be connected in this test");
  }

  async end() {}
}

/** A syntactically valid but unreachable URL — never a real credential. */
const FAKE_URL = "postgresql://test:test@127.0.0.1:1/cbe_test";

function forgetSingleton() {
  const store = globalThis as unknown as Record<string, unknown>;
  delete store.__cbeDb;
  delete store.__cbePool;
  delete store.__cbePglite;
}

beforeEach(() => {
  constructed.length = 0;
  listeners.length = 0;
  forgetSingleton();
  vi.resetModules();
  vi.doMock("pg", () => ({ Pool: FakePool, default: { Pool: FakePool } }));
  process.env.DATABASE_URL = FAKE_URL;
});

afterEach(() => {
  vi.doUnmock("pg");
  forgetSingleton();
  delete process.env.DATABASE_URL;
});

describe("production pool", () => {
  it("registers exactly one error listener", async () => {
    const { db } = await import("@/db/client");

    // The pool is created lazily on first use, not on import.
    expect(constructed).toHaveLength(0);
    void db.select;

    expect(constructed).toHaveLength(1);
    expect(listeners.filter((l) => l.event === "error")).toHaveLength(1);
  });

  it("does not add a listener per query", async () => {
    const { db } = await import("@/db/client");

    // Every property access goes through the resolving Proxy.
    for (let i = 0; i < 50; i += 1) {
      void db.select;
      void db.insert;
      void db.transaction;
    }

    expect(constructed).toHaveLength(1);
    expect(listeners.filter((l) => l.event === "error")).toHaveLength(1);
  });

  it("reuses the pinned pool across module re-evaluation without re-listening", async () => {
    const first = await import("@/db/client");
    void first.db.select;
    expect(constructed).toHaveLength(1);

    // HMR, a second bundle, a re-imported module — the pool must survive and
    // must not gain a second listener.
    vi.resetModules();
    const second = await import("@/db/client");
    void second.db.select;

    expect(constructed).toHaveLength(1);
    expect(listeners.filter((l) => l.event === "error")).toHaveLength(1);
  });

  it("logs a dying idle client without the connection string", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = await import("@/db/client");
    void db.select;

    const handler = listeners.find((l) => l.event === "error")?.handler;
    expect(handler).toBeTypeOf("function");

    handler?.(new Error("Connection terminated unexpectedly"));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({
      tag: "PG_POOL_ERROR",
      message: "Connection terminated unexpectedly",
    });

    // The URL carries a password; it must never reach the log.
    expect(line).not.toContain("postgresql://");
    expect(line).not.toContain("test:test");
    expect(line).not.toContain("127.0.0.1");

    errorSpy.mockRestore();
  });

  it("bounds the pool and both timeouts", async () => {
    const { db } = await import("@/db/client");
    void db.select;

    const options = constructed[0];
    expect(options.max).toBe(10);
    // A request that cannot get a connection must fail rather than hang while
    // holding whatever it has already allocated.
    expect(options.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(options.idleTimeoutMillis).toBeGreaterThan(0);
    expect(options.connectionString).toBe(FAKE_URL);
  });

  it("does not install a global uncaughtException handler", async () => {
    const before = process.listenerCount("uncaughtException");
    const { db } = await import("@/db/client");
    void db.select;

    // Swallowing every uncaught exception would hide real faults; the pool
    // listener is deliberately the only thing added.
    expect(process.listenerCount("uncaughtException")).toBe(before);
  });
});
