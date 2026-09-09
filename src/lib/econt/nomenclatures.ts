import { EcontError, econtCall } from "./client";
import type { EcontCity, EcontOffice } from "./types";

/**
 * Cached access to Econt's cities, offices and streets.
 *
 * Econt returns these lists whole, and `getCities` alone is a 17 MB body
 * describing 5 488 settlements — each with a nested location, per-weekday
 * opening hours and express-delivery flags. On a 512 MB service that single
 * response was the largest allocation in the process: ~35 MB of buffered bytes
 * plus the parsed graph, for a picker that needs four fields per city.
 *
 * Three things follow, and all three matter for memory rather than for
 * correctness:
 *
 *  - every list is **projected down to the fields the pickers use** before it
 *    is cached, so the retained cost is a fraction of the response;
 *  - concurrent callers **share one in-flight request** instead of each
 *    buffering their own copy of the body;
 *  - the per-city street cache is a **bounded LRU**, because its key arrives
 *    from a query string and an unbounded `Map` there was a genuine leak.
 */

const LIST_TTL_MS = 24 * 60 * 60 * 1000;
const STREETS_TTL_MS = 60 * 60 * 1000;

/** At ~40 street names per city this is a few hundred kilobytes at most. */
export const MAX_STREET_CACHE_ENTRIES = 300;

/**
 * Ceiling on distinct street lookups in flight at once. Entries are removed in
 * a `finally`, so this only ever trips under deliberate abuse — and then it
 * fails a request rather than growing the map.
 */
const MAX_STREET_REQUESTS_IN_FLIGHT = 64;

/** Raised when too many distinct street lookups are already running. */
export const ECONT_BUSY = "EcontBusy";

/* ------------------------------------------------------------------ *
 * Projected shapes — this is all that is ever held in memory
 * ------------------------------------------------------------------ */

export type CityRecord = {
  id: number;
  name: string;
  postCode: string;
  regionName: string;
};

export type OfficeRecord = {
  code: string;
  name: string;
  cityId: number | null;
  cityName: string;
  address: string;
  isAutomated: boolean;
};

type CityIndex = {
  list: CityRecord[];
  /** Membership test for an id that arrived from a query string. */
  ids: Set<number>;
};

type CacheEntry<T> = { value: T; expiresAt: number };

const caches = {
  cities: null as CacheEntry<CityIndex> | null,
  offices: null as CacheEntry<OfficeRecord[]> | null,
  /** Insertion-ordered, so the oldest key is the first one. */
  streets: new Map<number, CacheEntry<string[]>>(),
};

const inFlight = {
  cities: null as Promise<CityIndex> | null,
  offices: null as Promise<OfficeRecord[]> | null,
  streets: new Map<number, Promise<string[]>>(),
};

function fresh<T>(entry: CacheEntry<T> | null | undefined): T | null {
  if (!entry) return null;
  return entry.expiresAt > Date.now() ? entry.value : null;
}

/**
 * One structured line per real reload, so the cost of refilling a cache is
 * visible in the logs. Counts only — no city names, no addresses, no client
 * identity, no credentials.
 */
function logReload(kind: "cities" | "offices" | "streets", count: number) {
  console.info(JSON.stringify({ tag: "ECONT_CACHE_RELOAD", kind, count }));
}

/* ------------------------------------------------------------------ *
 * Cities
 * ------------------------------------------------------------------ */

function projectCity(city: EcontCity): CityRecord {
  return {
    id: city.id,
    name: city.name,
    postCode: city.postCode ?? "",
    regionName: city.regionName ?? "",
  };
}

async function loadCities(): Promise<CityIndex> {
  const response = await econtCall<{ cities?: EcontCity[] }>(
    "Nomenclatures/NomenclaturesService.getCities",
    { countryCode: "BGR" },
  );

  const list: CityRecord[] = [];
  const ids = new Set<number>();

  // Projected inside the loop so the raw graph is the only thing that has to
  // be collected afterwards — nothing from it is kept alive by a reference in
  // the cache.
  for (const city of response.cities ?? []) {
    if (!city.id || !city.name) continue;
    list.push(projectCity(city));
    ids.add(city.id);
  }

  const index: CityIndex = { list, ids };
  caches.cities = { value: index, expiresAt: Date.now() + LIST_TTL_MS };
  logReload("cities", list.length);
  return index;
}

async function cityIndex(): Promise<CityIndex> {
  const cached = fresh(caches.cities);
  if (cached) return cached;

  // Single-flight: whoever arrives while a load is running awaits the same
  // promise instead of buffering a second 17 MB body.
  const pending = inFlight.cities;
  if (pending) return pending;

  const started = loadCities().finally(() => {
    // Cleared on success *and* on failure, so a transient Econt error cannot
    // leave a permanently rejected promise behind for every later caller.
    inFlight.cities = null;
  });
  inFlight.cities = started;
  return started;
}

export async function getCities(): Promise<CityRecord[]> {
  return (await cityIndex()).list;
}

/** True when the id exists in Econt's own list of settlements. */
export async function isKnownCityId(cityId: number): Promise<boolean> {
  return (await cityIndex()).ids.has(cityId);
}

/* ------------------------------------------------------------------ *
 * Offices
 * ------------------------------------------------------------------ */

function projectOffice(office: EcontOffice): OfficeRecord {
  return {
    code: office.code,
    name: office.name,
    cityId: office.address?.city?.id ?? null,
    cityName: office.address?.city?.name ?? "",
    address: [
      office.address?.quarter,
      office.address?.street,
      office.address?.num,
      office.address?.other,
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
    isAutomated: Boolean(office.isAPS),
  };
}

async function loadOffices(): Promise<OfficeRecord[]> {
  const response = await econtCall<{ offices?: EcontOffice[] }>(
    "Nomenclatures/NomenclaturesService.getOffices",
    { countryCode: "BGR" },
  );

  const offices: OfficeRecord[] = [];
  for (const office of response.offices ?? []) {
    if (!office.code || !office.name) continue;
    offices.push(projectOffice(office));
  }

  caches.offices = { value: offices, expiresAt: Date.now() + LIST_TTL_MS };
  logReload("offices", offices.length);
  return offices;
}

export async function getOffices(): Promise<OfficeRecord[]> {
  const cached = fresh(caches.offices);
  if (cached) return cached;

  const pending = inFlight.offices;
  if (pending) return pending;

  const started = loadOffices().finally(() => {
    inFlight.offices = null;
  });
  inFlight.offices = started;
  return started;
}

/* ------------------------------------------------------------------ *
 * Streets — bounded LRU
 * ------------------------------------------------------------------ */

/** Drops every entry whose TTL has passed, freeing it rather than shadowing it. */
function purgeExpiredStreets(now: number) {
  for (const [cityId, entry] of caches.streets) {
    if (entry.expiresAt <= now) caches.streets.delete(cityId);
  }
}

function readStreetCache(cityId: number): string[] | null {
  const entry = caches.streets.get(cityId);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    // Physically removed, not just reported as stale.
    caches.streets.delete(cityId);
    return null;
  }

  // Re-inserting moves the key to the end, which is what makes the eviction
  // below least-recently-*used* rather than merely oldest-inserted.
  caches.streets.delete(cityId);
  caches.streets.set(cityId, entry);
  return entry.value;
}

function writeStreetCache(cityId: number, streets: string[]) {
  const now = Date.now();
  purgeExpiredStreets(now);

  caches.streets.delete(cityId);

  // Evict the least recently used until there is room for this one.
  while (caches.streets.size >= MAX_STREET_CACHE_ENTRIES) {
    const oldest = caches.streets.keys().next();
    if (oldest.done) break;
    caches.streets.delete(oldest.value);
  }

  caches.streets.set(cityId, {
    value: streets,
    expiresAt: now + STREETS_TTL_MS,
  });
}

async function loadStreets(cityId: number): Promise<string[]> {
  const response = await econtCall<{
    streets?: { id?: number; name?: string; nameEn?: string }[];
  }>("Nomenclatures/NomenclaturesService.getStreets", { cityID: cityId });

  const streets = [
    ...new Set(
      (response.streets ?? [])
        .map((s) => s.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, "bg"));

  writeStreetCache(cityId, streets);
  logReload("streets", streets.length);
  return streets;
}

/**
 * Streets for one city.
 *
 * The caller is responsible for having validated `cityId` against
 * {@link isKnownCityId} first — see `src/app/api/econt/lookup/route.ts`. That
 * ordering is what keeps a made-up id from reaching Econt or the cache.
 */
export async function getStreets(cityId: number): Promise<string[]> {
  const cached = readStreetCache(cityId);
  if (cached) return cached;

  const pending = inFlight.streets.get(cityId);
  if (pending) return pending;

  if (inFlight.streets.size >= MAX_STREET_REQUESTS_IN_FLIGHT) {
    throw new EcontError(
      "Твърде много едновременни заявки към Еконт. Моля, опитайте отново след малко.",
      { type: ECONT_BUSY },
    );
  }

  const started = loadStreets(cityId).finally(() => {
    inFlight.streets.delete(cityId);
  });
  inFlight.streets.set(cityId, started);
  return started;
}

/* ------------------------------------------------------------------ *
 * Search helpers used by the pickers
 * ------------------------------------------------------------------ */

export type CityOption = {
  id: number;
  name: string;
  postCode: string;
  region: string;
};

export async function searchCities(
  query: string,
  limit = 20,
): Promise<CityOption[]> {
  const cities = await getCities();
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const matches: CityOption[] = [];
  for (const city of cities) {
    if (
      !city.name.toLowerCase().startsWith(needle) &&
      !city.postCode.startsWith(needle)
    ) {
      continue;
    }
    matches.push({
      id: city.id,
      name: city.name,
      postCode: city.postCode,
      region: city.regionName,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}

export type OfficeOption = {
  code: string;
  name: string;
  cityName: string;
  cityId: number | null;
  address: string;
  isAutomated: boolean;
};

export async function searchOffices(
  query: string,
  cityId?: number,
  limit = 30,
): Promise<OfficeOption[]> {
  const offices = await getOffices();
  const needle = query.trim().toLowerCase();

  const matches: OfficeOption[] = [];
  for (const office of offices) {
    if (cityId && office.cityId !== cityId) continue;

    if (needle.length === 0) {
      if (!cityId) continue;
    } else {
      const haystack = [
        office.name,
        office.cityName,
        office.address,
        office.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) continue;
    }

    matches.push(office);
    if (matches.length >= limit) break;
  }
  return matches;
}

export async function searchStreets(
  cityId: number,
  query: string,
  limit = 20,
): Promise<string[]> {
  const streets = await getStreets(cityId);
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return streets.slice(0, limit);

  return streets
    .filter((street) => street.toLowerCase().includes(needle))
    .slice(0, limit);
}

/** Clears the in-memory nomenclature caches (used by the admin refresh action). */
export function clearNomenclatureCache(): void {
  caches.cities = null;
  caches.offices = null;
  caches.streets.clear();
}

/** Cache sizes, for tests and diagnostics. Carries no personal data. */
export function nomenclatureCacheStats(): {
  cities: number;
  offices: number;
  streets: number;
  streetsInFlight: number;
} {
  return {
    cities: caches.cities?.value.list.length ?? 0,
    offices: caches.offices?.value.length ?? 0,
    streets: caches.streets.size,
    streetsInFlight: inFlight.streets.size,
  };
}
