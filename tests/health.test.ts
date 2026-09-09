import { describe, expect, it, vi } from "vitest";

/**
 * The platform health check used to hit `/contacts`, which is `force-dynamic`
 * and reads the settings, the working hours and the active announcement — and
 * calls `getSettings()` three times across the metadata, the page and the
 * layout. At one probe every ~35 seconds that was roughly seven queries and a
 * full React render, about 1 700 times a day, purely to answer "are you alive".
 *
 * This route answers exactly that and nothing more, so the test asserts what it
 * does *not* do as much as what it returns.
 */

describe("GET /api/health", () => {
  it("returns 200 with a plain body and no caching", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("ok");
  });

  it("makes no database, storage, e-mail or Econt call", async () => {
    // Any outbound HTTP would go through fetch; any query would go through the
    // pool. Both are watched here.
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);

    const { GET } = await import("@/app/api/health/route");
    GET();

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("imports nothing from the data, storage or integration layers", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/health/route.ts", "utf8"),
    );

    // A probe that grows a dependency stops being a probe.
    for (const forbidden of [
      "@/db/",
      "@/server/queries",
      "@/lib/storage",
      "@/lib/econt",
      "@/lib/email",
      "@/lib/env",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("leaks nothing about the deployment", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = GET();
    const body = await response.text();

    expect(body).toBe("ok");
    // No version, no commit, no host, no environment name.
    expect(body.length).toBeLessThan(16);
    expect(response.headers.get("X-Powered-By")).toBeNull();
  });
});
