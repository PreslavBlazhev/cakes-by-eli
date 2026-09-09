import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The nomenclature cache was the single largest allocation in the process.
 *
 * `getCities` returns a 17 MB body describing 5 488 settlements, each with a
 * nested location and per-weekday opening hours — measured at ~85 MB of peak
 * RSS for one cold call. And the per-city street cache was keyed on a number
 * straight out of a query string, with no ceiling and no eviction: every
 * integer anyone cared to send became a permanent entry.
 *
 * These tests pin down all four fixes: the projection, the single-flight, the
 * bounded LRU, and the validation that keeps a made-up id out of both.
 */

const ENV = {
  ECONT_ENVIRONMENT: "demo",
  ECONT_USERNAME: "iasp-dev",
  ECONT_PASSWORD: "1Asp-dev",
  DATABASE_URL: "",
};

/** A city as Econt actually returns it — the bulk is what must NOT be kept. */
function econtCity(id: number) {
  return {
    id,
    name: `Град ${id}`,
    nameEn: `City ${id}`,
    postCode: String(5000 + id),
    regionName: `Област ${id}`,
    country: { id: 1033, code2: "BG", code3: "BGR", name: "България" },
    location: { latitude: 43.4 + id / 1000, longitude: 24.6, confidence: 5 },
    expressCityDeliveries: true,
    monday: "09:00-18:00",
    tuesday: "09:00-18:00",
    wednesday: "09:00-18:00",
    thursday: "09:00-18:00",
    friday: "09:00-18:00",
    saturday: "09:00-13:00",
    sunday: null,
    serviceDays: [1, 2, 3, 4, 5],
  };
}

function econtOffice(code: string, cityId: number) {
  return {
    id: Number(code),
    code,
    name: `Офис ${code}`,
    nameEn: `Office ${code}`,
    isAPS: code.endsWith("9"),
    phones: ["0700 17 000"],
    address: {
      city: { id: cityId, name: `Град ${cityId}`, postCode: String(5000 + cityId) },
      quarter: "кв. Център",
      street: "ул. Тестова",
      num: "1",
      other: null,
      fullAddress: "нещо дълго, което не ни трябва",
    },
    normalBusinessHoursFrom: 32400,
    normalBusinessHoursTo: 64800,
  };
}

type Nomenclatures = typeof import("@/lib/econt/nomenclatures");

let nomenclatures: Nomenclatures;
let fetchSpy: ReturnType<typeof vi.fn>;
/** The reload lines are asserted in one place; elsewhere they only add noise. */
const silenceInfo = () => vi.spyOn(console, "info").mockImplementation(() => {});
let infoSpy: ReturnType<typeof silenceInfo>;

/** Serves the three nomenclature endpoints, counting calls per service. */
function stubEcont(options: {
  cityIds?: number[];
  streetsFor?: (cityId: number) => string[];
  failStreets?: boolean;
  delayMs?: number;
} = {}) {
  const cityIds = options.cityIds ?? [1, 2, 3];

  fetchSpy = vi.fn(async (url: string, init: RequestInit) => {
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    if (url.includes("getCities")) {
      return jsonResponse({ cities: cityIds.map(econtCity) });
    }
    if (url.includes("getOffices")) {
      return jsonResponse({
        offices: [econtOffice("1001", 1), econtOffice("1009", 2)],
      });
    }
    if (url.includes("getStreets")) {
      if (options.failStreets) {
        return jsonResponse({ type: "ExServiceError", message: "нещо се обърка" }, 517);
      }
      const cityId = JSON.parse(String(init.body)).cityID as number;
      const names = options.streetsFor?.(cityId) ?? [
        "ул. Втора",
        "ул. Първа",
        "бул. Трети",
      ];
      return jsonResponse({ streets: names.map((name, i) => ({ id: i, name })) });
    }
    throw new Error(`unexpected Econt call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchSpy);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function callsTo(service: string): number {
  return fetchSpy.mock.calls.filter(([url]) => String(url).includes(service))
    .length;
}

beforeEach(async () => {
  for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
  vi.resetModules();
  vi.restoreAllMocks();
  infoSpy = silenceInfo();
  nomenclatures = await import("@/lib/econt/nomenclatures");
  nomenclatures.clearNomenclatureCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ *
 * Projection
 * ------------------------------------------------------------------ */

describe("city projection", () => {
  it("keeps only id, name, postCode and regionName", async () => {
    stubEcont({ cityIds: [7] });

    const cities = await nomenclatures.getCities();

    expect(cities).toHaveLength(1);
    // Exactly four keys — nothing of the nested graph survives.
    expect(Object.keys(cities[0]).sort()).toEqual([
      "id",
      "name",
      "postCode",
      "regionName",
    ]);
    expect(cities[0]).toEqual({
      id: 7,
      name: "Град 7",
      postCode: "5007",
      regionName: "Област 7",
    });
  });

  it("skips entries without an id or a name", async () => {
    fetchSpy = vi.fn(async () =>
      jsonResponse({
        cities: [
          econtCity(1),
          { id: 0, name: "Без id" },
          { id: 5, name: "" },
          { postCode: "1000" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    expect(await nomenclatures.getCities()).toHaveLength(1);
  });

  it("projects offices down to what the picker renders", async () => {
    stubEcont();

    const offices = await nomenclatures.getOffices();

    expect(Object.keys(offices[0]).sort()).toEqual([
      "address",
      "cityId",
      "cityName",
      "code",
      "isAutomated",
      "name",
    ]);
    expect(offices[0].address).toBe("кв. Център ул. Тестова 1");
    expect(offices[0].isAutomated).toBe(false);
    expect(offices[1].isAutomated).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Search behaviour must be unchanged
 * ------------------------------------------------------------------ */

describe("search", () => {
  it("still matches a city by the start of its name", async () => {
    stubEcont({ cityIds: [1, 2, 3] });

    const found = await nomenclatures.searchCities("град 2");
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({
      id: 2,
      name: "Град 2",
      postCode: "5002",
      region: "Област 2",
    });
  });

  it("still matches a city by the start of its post code", async () => {
    stubEcont({ cityIds: [1, 2, 3] });

    const found = await nomenclatures.searchCities("5003");
    expect(found.map((c) => c.id)).toEqual([3]);
  });

  it("needs at least two characters, as before", async () => {
    stubEcont();
    expect(await nomenclatures.searchCities("г")).toEqual([]);
  });

  it("honours the result limit", async () => {
    stubEcont({ cityIds: Array.from({ length: 50 }, (_, i) => i + 1) });
    expect(await nomenclatures.searchCities("град", 5)).toHaveLength(5);
  });

  it("filters offices by city and by free text", async () => {
    stubEcont();

    expect(await nomenclatures.searchOffices("", 2)).toHaveLength(1);
    // No text and no city means no result — unchanged behaviour.
    expect(await nomenclatures.searchOffices("")).toHaveLength(0);
    expect(await nomenclatures.searchOffices("тестова")).toHaveLength(2);
    expect(await nomenclatures.searchOffices("1009")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * Single-flight
 * ------------------------------------------------------------------ */

describe("single-flight", () => {
  it("shares one cities request between concurrent callers", async () => {
    stubEcont({ delayMs: 20 });

    const results = await Promise.all([
      nomenclatures.getCities(),
      nomenclatures.getCities(),
      nomenclatures.getCities(),
      nomenclatures.searchCities("град 1"),
    ]);

    // Four callers, one 17 MB body.
    expect(callsTo("getCities")).toBe(1);
    expect(results[0]).toBe(results[1]);
  });

  it("shares one offices request between concurrent callers", async () => {
    stubEcont({ delayMs: 20 });

    await Promise.all([
      nomenclatures.getOffices(),
      nomenclatures.getOffices(),
      nomenclatures.searchOffices("тестова"),
    ]);

    expect(callsTo("getOffices")).toBe(1);
  });

  it("shares one streets request per city between concurrent callers", async () => {
    stubEcont({ delayMs: 20 });

    await Promise.all([
      nomenclatures.getStreets(1),
      nomenclatures.getStreets(1),
      nomenclatures.getStreets(2),
      nomenclatures.getStreets(2),
    ]);

    // Two cities, two requests — not four.
    expect(callsTo("getStreets")).toBe(2);
  });

  it("clears the in-flight slot on failure so the next caller retries", async () => {
    stubEcont({ failStreets: true });

    // Both concurrent callers see the same rejection…
    const first = await Promise.allSettled([
      nomenclatures.getStreets(1),
      nomenclatures.getStreets(1),
    ]);
    expect(first.every((r) => r.status === "rejected")).toBe(true);
    expect(callsTo("getStreets")).toBe(1);
    // …and nothing was cached for a failed load.
    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(0);
    expect(nomenclatures.nomenclatureCacheStats().streetsInFlight).toBe(0);

    // A later attempt is a fresh request, not a replay of the rejected promise.
    stubEcont();
    const streets = await nomenclatures.getStreets(1);
    expect(streets.length).toBeGreaterThan(0);
    expect(callsTo("getStreets")).toBe(1);
  });

  it("clears the cities in-flight slot on failure too", async () => {
    fetchSpy = vi.fn(async () =>
      jsonResponse({ type: "ExServiceError", message: "недостъпно" }, 517),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(nomenclatures.getCities()).rejects.toThrow();

    stubEcont({ cityIds: [42] });
    const cities = await nomenclatures.getCities();
    expect(cities.map((c) => c.id)).toEqual([42]);
  });
});

/* ------------------------------------------------------------------ *
 * Bounded LRU
 * ------------------------------------------------------------------ */

describe("streets cache bounds", () => {
  it("never exceeds the ceiling, however many cities are asked for", async () => {
    stubEcont();
    const ceiling = nomenclatures.MAX_STREET_CACHE_ENTRIES;

    for (let cityId = 1; cityId <= ceiling + 120; cityId += 1) {
      await nomenclatures.getStreets(cityId);
    }

    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(ceiling);
    expect(nomenclatures.nomenclatureCacheStats().streetsInFlight).toBe(0);
  });

  it("evicts the least recently used city, not the most recently used", async () => {
    stubEcont();
    const ceiling = nomenclatures.MAX_STREET_CACHE_ENTRIES;

    for (let cityId = 1; cityId <= ceiling; cityId += 1) {
      await nomenclatures.getStreets(cityId);
    }
    expect(callsTo("getStreets")).toBe(ceiling);

    // Touch city 1 — a cache hit, which promotes it to most-recently-used.
    await nomenclatures.getStreets(1);
    expect(callsTo("getStreets")).toBe(ceiling);

    // One more city forces exactly one eviction.
    await nomenclatures.getStreets(ceiling + 1);
    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(ceiling);

    // City 1 survived: still no new request for it.
    await nomenclatures.getStreets(1);
    expect(callsTo("getStreets")).toBe(ceiling + 1);

    // City 2 was the least recently used, so it is gone and has to be fetched.
    await nomenclatures.getStreets(2);
    expect(callsTo("getStreets")).toBe(ceiling + 2);
  });

  it("removes expired entries physically rather than merely ignoring them", async () => {
    stubEcont();
    const realNow = Date.now();
    const clock = vi.spyOn(Date, "now");
    clock.mockReturnValue(realNow);

    await nomenclatures.getStreets(1);
    await nomenclatures.getStreets(2);
    await nomenclatures.getStreets(3);
    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(3);

    // Past the one-hour street TTL.
    clock.mockReturnValue(realNow + 61 * 60 * 1000);

    // A read drops the entry it finds stale…
    await nomenclatures.getStreets(1);
    // …and the write that follows sweeps the rest, so only the fresh one is
    // left rather than three shadowed corpses.
    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(1);

    clock.mockRestore();
  });

  it("keeps serving a city from cache within the TTL", async () => {
    stubEcont();

    await nomenclatures.getStreets(9);
    await nomenclatures.getStreets(9);
    await nomenclatures.getStreets(9);

    expect(callsTo("getStreets")).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 * City id validation
 * ------------------------------------------------------------------ */

describe("city id validation", () => {
  it("recognises a real id and refuses one that is not in the list", async () => {
    stubEcont({ cityIds: [11, 12] });

    expect(await nomenclatures.isKnownCityId(11)).toBe(true);
    expect(await nomenclatures.isKnownCityId(999_999)).toBe(false);
    // The membership test is served from the same cached list.
    expect(callsTo("getCities")).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 * Admin refresh
 * ------------------------------------------------------------------ */

describe("clearNomenclatureCache", () => {
  it("empties every cache so the next read refetches", async () => {
    stubEcont();

    await nomenclatures.getCities();
    await nomenclatures.getOffices();
    await nomenclatures.getStreets(1);

    expect(nomenclatures.nomenclatureCacheStats()).toMatchObject({
      streets: 1,
    });

    nomenclatures.clearNomenclatureCache();

    expect(nomenclatures.nomenclatureCacheStats()).toEqual({
      cities: 0,
      offices: 0,
      streets: 0,
      streetsInFlight: 0,
    });

    await nomenclatures.getCities();
    expect(callsTo("getCities")).toBe(2);
  });
});

/* ------------------------------------------------------------------ *
 * Logging hygiene
 * ------------------------------------------------------------------ */

describe("reload logging", () => {
  it("logs a count on a real reload and nothing identifying", async () => {
    stubEcont({ cityIds: [1, 2, 3, 4] });

    await nomenclatures.getCities();
    // A cache hit must not log again.
    await nomenclatures.getCities();

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const serialised = String(infoSpy.mock.calls[0][0]);
    expect(JSON.parse(serialised)).toEqual({
      tag: "ECONT_CACHE_RELOAD",
      kind: "cities",
      count: 4,
    });

    // Credentials, city names, region names and street names must never appear.
    for (const forbidden of ["iasp-dev", "1Asp-dev", "Град", "Област", "ул."]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

/* ------------------------------------------------------------------ *
 * The public endpoint
 * ------------------------------------------------------------------ */

describe("GET /api/econt/lookup", () => {
  async function get(query: string): Promise<Response> {
    const { GET } = await import("@/app/api/econt/lookup/route");
    return GET(new Request(`http://localhost/api/econt/lookup?${query}`));
  }

  it("refuses a well-formed but non-existent cityId without touching Econt", async () => {
    stubEcont({ cityIds: [11, 12] });

    const response = await get("kind=streets&cityId=987654&q=ул");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Населеното място не е намерено в номенклатурата на Еконт.",
    });

    // The whole point: no request went out, and nothing was cached for it.
    expect(callsTo("getStreets")).toBe(0);
    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(0);
  });

  it("still rejects a malformed cityId before anything else", async () => {
    stubEcont();

    for (const raw of ["abc", "-4", "0", "1.5"]) {
      const response = await get(`kind=streets&cityId=${raw}`);
      expect(response.status).toBe(400);
    }

    expect(callsTo("getCities")).toBe(0);
    expect(callsTo("getStreets")).toBe(0);
  });

  it("serves streets for a real city", async () => {
    stubEcont({ cityIds: [11] });

    const response = await get("kind=streets&cityId=11&q=ул");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: string[] };
    // Sorted with the Bulgarian collation, and "бул." contains "ул" too — the
    // filter is a substring match, unchanged from before.
    expect(body.items).toEqual(["бул. Трети", "ул. Втора", "ул. Първа"]);
    expect(nomenclatures.nomenclatureCacheStats().streets).toBe(1);
  });

  it("applies the same city check to office lookups", async () => {
    stubEcont({ cityIds: [1, 2] });

    const bad = await get("kind=offices&cityId=424242");
    expect(bad.status).toBe(400);

    const good = await get("kind=offices&cityId=2");
    expect(good.status).toBe(200);
  });

  it("throttles a caller that goes past the window", async () => {
    stubEcont({ cityIds: [1] });

    let last: Response | null = null;
    for (let i = 0; i < 62; i += 1) last = await get("kind=cities&q=град");

    expect(last?.status).toBe(429);
  });
});
