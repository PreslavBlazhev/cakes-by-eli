import { NextResponse } from "next/server";

import { EcontError, econtIsConfigured } from "@/lib/econt/client";
import {
  ECONT_BUSY,
  isKnownCityId,
  searchCities,
  searchOffices,
  searchStreets,
} from "@/lib/econt/nomenclatures";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Nomenclature lookups for the delivery pickers.
 *
 * Read-only and served from an in-memory cache, but still throttled so the
 * endpoint cannot be used to hammer Econt on a cold cache.
 *
 * `cityId` arrives from a query string, so it is checked against Econt's own
 * list of settlements before it is allowed to reach the streets endpoint. That
 * check is what keeps a made-up id out of the per-city street cache — without
 * it, every integer someone cared to send became a permanent entry.
 */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request.headers, "econt-lookup"), {
    limit: 60,
    windowMs: 60_000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Твърде много заявки. Опитайте отново след малко." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  if (!econtIsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Доставката с Еконт не е конфигурирана. Моля, изберете вземане на място или се свържете с нас.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const query = (url.searchParams.get("q") ?? "").slice(0, 60);
  const cityIdRaw = url.searchParams.get("cityId");
  const cityId = cityIdRaw ? Number(cityIdRaw) : undefined;

  if (cityIdRaw && (!Number.isInteger(cityId) || (cityId ?? 0) <= 0)) {
    return NextResponse.json({ error: "Невалиден идентификатор на град." }, { status: 400 });
  }

  try {
    if (kind === "cities") {
      return NextResponse.json({ items: await searchCities(query) });
    }

    // Any id that reached this point is well-formed; now check that it is real.
    // Done once, before either branch that accepts one, so nothing downstream
    // has to repeat it.
    if (cityId !== undefined && !(await isKnownCityId(cityId))) {
      return NextResponse.json(
        { error: "Населеното място не е намерено в номенклатурата на Еконт." },
        { status: 400 },
      );
    }

    if (kind === "offices") {
      return NextResponse.json({ items: await searchOffices(query, cityId) });
    }

    if (kind === "streets") {
      if (!cityId) {
        return NextResponse.json(
          { error: "Първо изберете населено място." },
          { status: 400 },
        );
      }
      return NextResponse.json({ items: await searchStreets(cityId, query) });
    }

    return NextResponse.json({ error: "Неизвестна заявка." }, { status: 400 });
  } catch (error) {
    if (error instanceof EcontError) {
      if (error.type === ECONT_BUSY) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      // Type and details only — never the query, the client address or the
      // credentials.
      console.error("Econt lookup failed:", error.type, error.details);
      return NextResponse.json(
        { error: "Списъкът от Еконт не може да бъде зареден в момента." },
        { status: 502 },
      );
    }
    console.error("Econt lookup failed:", error);
    return NextResponse.json(
      { error: "Възникна неочаквана грешка." },
      { status: 500 },
    );
  }
}
