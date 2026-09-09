import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the platform health check.
 *
 * Deliberately inert: no database, no storage, no e-mail, no Econt. It used to
 * be `/contacts`, which is `force-dynamic` and reads the settings, the working
 * hours and the active announcement — and calls `getSettings()` three times
 * across the metadata, the page and the layout. At one probe every ~35 seconds
 * that was around seven queries and a full React render, roughly 1 700 times a
 * day, purely to answer "are you alive".
 *
 * It answers exactly that. Nothing here reveals a version, a commit, an
 * environment value or the state of any dependency — a probe endpoint is
 * reachable without authentication, so it says as little as possible.
 */
export function GET() {
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
