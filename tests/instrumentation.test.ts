import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The memory log is the instrument that was missing when the service started
 * being killed at 512 MB: Render reports the kill but never what the process
 * was holding, so there was no way to tell a retained-object leak from native
 * memory from V8 simply never feeling any pressure.
 *
 * It has to be free when off, silent about anything personal, and incapable of
 * keeping the process alive or of running twice.
 */

const KEYS = [
  "tag",
  "uptimeS",
  "rssMB",
  "peakRssMB",
  "heapTotalMB",
  "heapUsedMB",
  "externalMB",
  "arrayBuffersMB",
  "heapLimitMB",
  "resources",
];

let infoSpy: ReturnType<typeof silenceInfo>;
const silenceInfo = () => vi.spyOn(console, "info").mockImplementation(() => {});

function forgetGuard() {
  delete (globalThis as unknown as Record<string, unknown>).__cbeMemlogStarted;
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  forgetGuard();
  infoSpy = silenceInfo();
  delete process.env.MEMLOG;
  delete process.env.NEXT_RUNTIME;
});

afterEach(() => {
  forgetGuard();
  delete process.env.MEMLOG;
  delete process.env.NEXT_RUNTIME;
});

describe("gating", () => {
  it("does nothing without MEMLOG=1", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("@/instrumentation");

    await register();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("does nothing outside the Node runtime", async () => {
    process.env.MEMLOG = "1";
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("@/instrumentation");

    await register();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("does nothing when MEMLOG is anything other than 1", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("@/instrumentation");

    for (const value of ["0", "true", "yes", ""]) {
      process.env.MEMLOG = value;
      forgetGuard();
      await register();
    }

    expect(infoSpy).not.toHaveBeenCalled();
  });
});

describe("gate wiring", () => {
  it("reaches the Node-only sampler when both switches are on", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.MEMLOG = "1";

    const { register } = await import("@/instrumentation");
    await register();

    // One boot line proves the gate imported and started the sampler.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(infoSpy.mock.calls[0][0])).tag).toBe("MEM");
  });

  it("never imports the Node module in the Edge runtime", async () => {
    // The Edge bundle has no process.memoryUsage and no node:v8, which is the
    // whole reason the sampler lives in its own file.
    process.env.NEXT_RUNTIME = "edge";
    process.env.MEMLOG = "1";

    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/instrumentation.ts", "utf8"),
    );
    // Comments may name these; the compiled code must not contain them, since
    // Turbopack analyses this file for the Edge bundle whatever the guard says.
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toContain("memoryUsage");
    expect(code).not.toContain("node:v8");
    expect(code).not.toContain("getActiveResourcesInfo");
    // The Node half is reached only through a dynamic import.
    expect(code).toContain('await import("./instrumentation-node")');

    const { register } = await import("@/instrumentation");
    await register();
    expect(infoSpy).not.toHaveBeenCalled();
  });
});

describe("the sampler itself", () => {
  it("emits one line at boot with exactly the expected counters", async () => {
    const { startMemoryLog } = await import("@/instrumentation-node");
    await startMemoryLog();

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(infoSpy.mock.calls[0][0]));

    expect(Object.keys(line).sort()).toEqual([...KEYS].sort());
    expect(line.tag).toBe("MEM");
    expect(line.rssMB).toBeGreaterThan(0);
    expect(line.heapUsedMB).toBeGreaterThan(0);
    // The whole point of reading this one: V8 sizes its heap from the host's
    // RAM, not the container's.
    expect(line.heapLimitMB).toBeGreaterThan(0);
    expect(typeof line.resources).toBe("object");
  });

  it("groups active resources by kind and by nothing else", async () => {
    const { startMemoryLog } = await import("@/instrumentation-node");
    await startMemoryLog();

    const line = JSON.parse(String(infoSpy.mock.calls[0][0]));
    for (const [kind, total] of Object.entries(line.resources)) {
      // Node's own type names — never a file descriptor, address or payload.
      expect(kind).toMatch(/^[A-Za-z]+$/);
      expect(typeof total).toBe("number");
    }
  });

  it("starts at most one timer however many times it is started", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const { startMemoryLog } = await import("@/instrumentation-node");

    await startMemoryLog();
    await startMemoryLog();
    await startMemoryLog();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    // And only the single boot line, not three.
    expect(infoSpy).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
  });

  it("never keeps the process alive", async () => {
    const timers: NodeJS.Timeout[] = [];
    const real = globalThis.setInterval;
    const spy = vi
      .spyOn(globalThis, "setInterval")
      .mockImplementation(((handler: () => void, ms?: number) => {
        const timer = real(handler, ms);
        timers.push(timer);
        return timer;
      }) as typeof globalThis.setInterval);

    const { startMemoryLog } = await import("@/instrumentation-node");
    await startMemoryLog();

    expect(timers).toHaveLength(1);
    // `.unref()` is what makes this true; without it the interval would hold
    // the event loop open forever.
    expect(timers[0].hasRef()).toBe(false);

    clearInterval(timers[0]);
    spy.mockRestore();
  });

  it("logs no identifying information at all", async () => {
    process.env.SESSION_SECRET = "not-a-real-secret-just-for-this-assertion";
    const { startMemoryLog } = await import("@/instrumentation-node");
    await startMemoryLog();

    const line = String(infoSpy.mock.calls[0][0]);

    for (const forbidden of [
      "not-a-real-secret",
      "http",
      "@",
      "/",
      process.cwd(),
    ]) {
      expect(line).not.toContain(forbidden);
    }

    delete process.env.SESSION_SECRET;
  });
});
