import { env } from "@/lib/env";
import type { EcontApiError, EcontEnvironment } from "./types";

/**
 * Low-level transport for the Econt Delivery API.
 *
 * Verified against the live demo environment. Two details matter and are easy
 * to get wrong:
 *
 *  1. The request must declare `charset=utf-8`. Without it Econt mangles every
 *     Cyrillic string — names silently become empty and addresses stop
 *     matching the nomenclature, producing errors that point at the wrong
 *     field entirely.
 *  2. Errors come back with HTTP 517 and a *nested* error tree, so a readable
 *     message has to be flattened out of `innerErrors`.
 */

const BASE_URLS: Record<EcontEnvironment, string> = {
  demo: "https://demo.econt.com/ee/services",
  production: "https://ee.econt.com/services",
};

export class EcontError extends Error {
  readonly type: string;
  readonly details: string[];
  readonly httpStatus: number;

  constructor(message: string, options: {
    type?: string;
    details?: string[];
    httpStatus?: number;
  } = {}) {
    super(message);
    this.name = "EcontError";
    this.type = options.type ?? "EcontError";
    this.details = options.details ?? [];
    this.httpStatus = options.httpStatus ?? 0;
  }
}

export class EcontNotConfiguredError extends EcontError {
  constructor() {
    super(
      "Интеграцията с Еконт не е конфигурирана. Попълнете ECONT_USERNAME и ECONT_PASSWORD.",
      { type: "EcontNotConfigured" },
    );
    this.name = "EcontNotConfiguredError";
  }
}

export function econtEnvironment(): EcontEnvironment {
  return env.ECONT_ENVIRONMENT;
}

export function econtIsConfigured(): boolean {
  return Boolean(env.ECONT_USERNAME && env.ECONT_PASSWORD);
}

export function econtBaseUrl(): string {
  return BASE_URLS[econtEnvironment()];
}

/** Calls one Econt service method and returns its parsed JSON body. */
export async function econtCall<TResponse>(
  service: string,
  body: unknown,
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {},
): Promise<TResponse> {
  if (!econtIsConfigured()) throw new EcontNotConfiguredError();

  const url = `${econtBaseUrl()}/${service}.json`;
  const credentials = Buffer.from(
    `${env.ECONT_USERNAME}:${env.ECONT_PASSWORD}`,
    "utf8",
  ).toString("base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        // Required — see the note at the top of this file.
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new EcontError(
        "Еконт не отговори навреме. Моля, опитайте отново след малко.",
        { type: "Timeout" },
      );
    }
    throw new EcontError(
      `Връзката с Еконт се провали: ${error instanceof Error ? error.message : "неизвестна грешка"}`,
      { type: "Network" },
    );
  }
  clearTimeout(timer);

  const text = await response.text();

  if (response.status === 401 || response.status === 403) {
    throw new EcontError(
      "Еконт отказа достъп. Проверете ECONT_USERNAME и ECONT_PASSWORD.",
      { type: "Unauthorized", httpStatus: response.status },
    );
  }

  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new EcontError(
      `Еконт върна неочакван отговор (HTTP ${response.status}).`,
      { type: "BadResponse", httpStatus: response.status },
    );
  }

  if (!response.ok || isApiError(payload)) {
    const details = flattenEcontError(payload as EcontApiError);
    throw new EcontError(details[0] ?? "Еконт отхвърли заявката.", {
      type: (payload as EcontApiError).type ?? "ExInvalidParam",
      details,
      httpStatus: response.status,
    });
  }

  return payload as TResponse;
}

function isApiError(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as EcontApiError;
  return typeof candidate.type === "string" && candidate.type.startsWith("Ex");
}

/**
 * Flattens Econt's nested error tree into readable Bulgarian lines.
 *
 * Parent nodes usually carry an empty or purely contextual message
 * („подател: “), so those are used as a prefix for the leaves beneath them.
 */
export function flattenEcontError(error: EcontApiError): string[] {
  const out: string[] = [];

  const walk = (node: EcontApiError, prefix: string) => {
    const message = (node.message ?? "").trim().replace(/:$/, "");
    const nextPrefix = message ? [prefix, message].filter(Boolean).join(" — ") : prefix;

    const children = node.innerErrors ?? [];
    if (children.length === 0) {
      const fields = node.fields?.length ? ` (${node.fields.join(", ")})` : "";
      const line = `${nextPrefix}${fields}`.trim();
      if (line) out.push(line);
      else if (node.type) out.push(node.type);
      return;
    }

    for (const child of children) walk(child, nextPrefix);
  };

  walk(error, "");
  return out.length > 0 ? out : ["Еконт отхвърли заявката без описание."];
}
