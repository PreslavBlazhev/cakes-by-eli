import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Background work must not be able to kill the server.
 *
 * Node terminates the process on an unhandled rejection, and order
 * notifications used to be handed to `after()` as an *already started* promise:
 *
 *     await scheduleAfterResponse(notify({ … }));   // ← started here
 *     //   inside: const { after } = await import("next/server");
 *     //           after(work);                     // ← handled only here
 *
 * Anything that failed in the gap between those two lines had no handler at
 * all. Passing a factory closes the gap, and `runSafely` covers the rest.
 */

type AfterResponse = typeof import("@/lib/after-response");

let errorSpy: ReturnType<typeof silenceError>;
const silenceError = () => vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  errorSpy = silenceError();
});

afterEach(() => {
  vi.doUnmock("next/server");
});

/** Captures whatever `after()` is given, so the test can fire it by hand. */
function mockAfter(): { callbacks: (() => unknown)[] } {
  const callbacks: (() => unknown)[] = [];
  vi.doMock("next/server", () => ({
    after: (callback: () => unknown) => {
      callbacks.push(callback);
    },
  }));
  return { callbacks };
}

async function load(): Promise<AfterResponse> {
  return import("@/lib/after-response");
}

describe("runSafely", () => {
  it("contains a rejection and logs one structured line", async () => {
    const { runSafely } = await load();

    await expect(
      runSafely(async () => {
        throw new Error("провален доставчик");
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toEqual({
      tag: "AFTER_RESPONSE_FAILED",
      message: "провален доставчик",
    });
  });

  it("contains a synchronous throw as well as a rejected promise", async () => {
    const { runSafely } = await load();

    await expect(
      runSafely(() => {
        throw new Error("веднага");
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("merges context into the line without adding anything else", async () => {
    const { runSafely } = await load();

    await runSafely(
      async () => {
        throw new Error("SMTP timeout");
      },
      "ORDER_EMAIL_FAILED",
      { kind: "OWNER_NEW_ORDER" },
    );

    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toEqual({
      tag: "ORDER_EMAIL_FAILED",
      kind: "OWNER_NEW_ORDER",
      message: "SMTP timeout",
    });
  });

  it("logs nothing when the work succeeds", async () => {
    const { runSafely } = await load();
    await runSafely(async () => {});
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("scheduleAfterResponse — rejection before after() is registered", () => {
  it("does not start the work until the callback runs", async () => {
    const { callbacks } = mockAfter();
    const { scheduleAfterResponse } = await load();

    let started = false;
    await scheduleAfterResponse(async () => {
      started = true;
      throw new Error("никога не трябва да е започнало рано");
    });

    // This is the regression: the old signature took a promise, so the work
    // was already running — and already able to reject — by this point.
    expect(started).toBe(false);
    expect(callbacks).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("survives a factory that throws the moment it is invoked", async () => {
    const { callbacks } = mockAfter();
    const { scheduleAfterResponse } = await load();

    await scheduleAfterResponse(() => {
      throw new Error("моментален отказ");
    });

    await expect(callbacks[0]()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAfterResponse — rejection after after() is registered", () => {
  it("contains the rejection inside the registered callback", async () => {
    const { callbacks } = mockAfter();
    const { scheduleAfterResponse } = await load();

    await scheduleAfterResponse(async () => {
      throw new Error("доставчикът отказа");
    });

    // Whatever the platform does with the returned value, it never sees a
    // rejected promise.
    await expect(callbacks[0]()).resolves.toBeUndefined();
    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toMatchObject({
      tag: "AFTER_RESPONSE_FAILED",
      message: "доставчикът отказа",
    });
  });

  it("invokes the factory exactly once", async () => {
    const { callbacks } = mockAfter();
    const { scheduleAfterResponse } = await load();

    const work = vi.fn(async () => {});
    await scheduleAfterResponse(work);
    await callbacks[0]();

    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleAfterResponse — no request scope", () => {
  it("runs the work inline, once, when after() refuses to schedule", async () => {
    vi.doMock("next/server", () => ({
      after: () => {
        throw new Error("`after` was called outside a request scope");
      },
    }));
    const { scheduleAfterResponse } = await load();

    const work = vi.fn(async () => {});
    await scheduleAfterResponse(work);

    // Exactly once: the throw happens before `after` can call the callback,
    // so the inline fallback is not a second run.
    expect(work).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("still contains a failure on the inline path", async () => {
    vi.doMock("next/server", () => ({
      after: () => {
        throw new Error("outside a request scope");
      },
    }));
    const { scheduleAfterResponse } = await load();

    await expect(
      scheduleAfterResponse(async () => {
        throw new Error("провал офлайн");
      }),
    ).resolves.toBeUndefined();

    expect(JSON.parse(String(errorSpy.mock.calls[0][0]))).toMatchObject({
      message: "провал офлайн",
    });
  });

  it("runs the work inline when next/server cannot be imported at all", async () => {
    vi.doMock("next/server", () => {
      throw new Error("module not found");
    });
    const { scheduleAfterResponse } = await load();

    const work = vi.fn(async () => {});
    await scheduleAfterResponse(work);

    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("no unhandled rejections escape", () => {
  it("leaves the process listener untouched across every path", async () => {
    const seen: unknown[] = [];
    const listener = (reason: unknown) => seen.push(reason);
    process.on("unhandledRejection", listener);

    try {
      const { callbacks } = mockAfter();
      const { scheduleAfterResponse, runSafely } = await load();

      await scheduleAfterResponse(async () => {
        throw new Error("а");
      });
      await callbacks[0]();
      await runSafely(async () => {
        throw new Error("б");
      });

      // Give the microtask queue a turn to surface anything unhandled.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(seen).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });
});
