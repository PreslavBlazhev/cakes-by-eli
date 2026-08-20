import { econtCall } from "./client";
import type { EcontCity, EcontOffice } from "./types";

/**
 * Cached access to Econt's cities, offices and streets.
 *
 * These lists change rarely but are large (5 000+ cities), so they are held in
 * memory for an hour per server process. Address delivery only validates when
 * the city id and the street name come from these lists, which is why the UI
 * always picks from them rather than accepting free text.
 */

type CacheEntry<T> = { value: T; expiresAt: number };

const TTL_MS = 60 * 60 * 1000;

const caches = {
  cities: null as CacheEntry<EcontCity[]> | null,
  offices: null as CacheEntry<EcontOffice[]> | null,
  streets: new Map<number, CacheEntry<string[]>>(),
};

function fresh<T>(entry: CacheEntry<T> | null | undefined): T | null {
  if (!entry) return null;
  return entry.expiresAt > Date.now() ? entry.value : null;
}

export async function getCities(): Promise<EcontCity[]> {
  const cached = fresh(caches.cities);
  if (cached) return cached;

  const response = await econtCall<{ cities?: EcontCity[] }>(
    "Nomenclatures/NomenclaturesService.getCities",
    { countryCode: "BGR" },
  );

  const cities = (response.cities ?? []).filter((c) => c.id && c.name);
  caches.cities = { value: cities, expiresAt: Date.now() + TTL_MS };
  return cities;
}

export async function getOffices(): Promise<EcontOffice[]> {
  const cached = fresh(caches.offices);
  if (cached) return cached;

  const response = await econtCall<{ offices?: EcontOffice[] }>(
    "Nomenclatures/NomenclaturesService.getOffices",
    { countryCode: "BGR" },
  );

  const offices = (response.offices ?? []).filter((o) => o.code && o.name);
  caches.offices = { value: offices, expiresAt: Date.now() + TTL_MS };
  return offices;
}

export async function getStreets(cityId: number): Promise<string[]> {
  const cached = fresh(caches.streets.get(cityId));
  if (cached) return cached;

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

  caches.streets.set(cityId, {
    value: streets,
    expiresAt: Date.now() + TTL_MS,
  });
  return streets;
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

  return cities
    .filter(
      (city) =>
        city.name.toLowerCase().startsWith(needle) ||
        (city.postCode ?? "").startsWith(needle),
    )
    .slice(0, limit)
    .map((city) => ({
      id: city.id,
      name: city.name,
      postCode: city.postCode ?? "",
      region: city.regionName ?? "",
    }));
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

  const matches = offices.filter((office) => {
    if (cityId && office.address?.city?.id !== cityId) return false;
    if (needle.length === 0) return Boolean(cityId);

    const haystack = [
      office.name,
      office.address?.city?.name,
      office.address?.street,
      office.address?.other,
      office.code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });

  return matches.slice(0, limit).map((office) => ({
    code: office.code,
    name: office.name,
    cityName: office.address?.city?.name ?? "",
    cityId: office.address?.city?.id ?? null,
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
  }));
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
