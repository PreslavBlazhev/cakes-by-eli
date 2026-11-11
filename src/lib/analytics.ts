/**
 * Analytics through Google Tag Manager, gated on cookie consent.
 *
 * Nothing here talks to Google until the visitor has said yes: the GTM
 * script is injected only after consent, and every dataLayer push goes
 * through `track()`, which drops events while consent is missing. GA4 itself
 * is configured inside the GTM container, never directly on the page, so
 * there is exactly one path that can report a hit.
 *
 * Events carry no personal data and nothing typed into a form — only what
 * kind of link was clicked, or that an order went through.
 */

export const GTM_ID = "GTM-N9558DQK";

/** First-party cookie that remembers the visitor's choice. */
export const CONSENT_COOKIE = "cbe_cookie_consent";
/** Bump to ask everyone again if what we collect ever changes. */
export const CONSENT_VERSION = "1";
/** 180 days — the choice is asked again after that. */
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

/** Fired on window when the footer link asks for the banner again. */
export const OPEN_CONSENT_EVENT = "cbe:open-cookie-settings";

export type ConsentChoice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/* ------------------------------------------------------------- Consent */

export function parseConsentCookie(cookieHeader: string): ConsentChoice | null {
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName !== CONSENT_COOKIE) continue;
    const [version, choice] = decodeURIComponent(rest.join("=")).split(":");
    if (version !== CONSENT_VERSION) return null;
    return choice === "granted" || choice === "denied" ? choice : null;
  }
  return null;
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  return parseConsentCookie(document.cookie);
}

export function writeConsent(choice: ConsentChoice) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${CONSENT_COOKIE}=${CONSENT_VERSION}:${choice}; Path=/; ` +
    `Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Removes Google Analytics cookies (`_ga`, `_ga_<id>`, `_gid`, …) after a withdrawal. */
export function clearAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => /^(_ga|_gid|_gat|_gcl)/.test(n));

  // The cookies are usually set on the registrable domain (".example.bg"),
  // so try every suffix of the host as well as host-only.
  const parts = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) {
    domains.push(`; Domain=.${parts.slice(i).join(".")}`);
  }

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Max-Age=0${domain}`;
    }
  }
}

/* ----------------------------------------------------------- dataLayer */

function dataLayer(): unknown[] {
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

/** The `gtag()` shape — pushes the `arguments` object, which is what GTM expects for consent commands. */
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  dataLayer().push(arguments);
}

let gtmLoaded = false;

/**
 * Loads the container once. Consent Mode is set first, so tags that check
 * `analytics_storage` see it granted; advertising stays denied because the
 * banner only asks about statistics.
 */
export function loadGtm() {
  if (gtmLoaded || typeof window === "undefined") return;
  gtmLoaded = true;

  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  gtag("consent", "update", { analytics_storage: "granted" });

  dataLayer().push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

export function isGtmLoaded() {
  return gtmLoaded;
}

/** Tells an already-loaded container to stop storing analytics cookies. */
export function revokeConsentInGtm() {
  if (!gtmLoaded) return;
  gtag("consent", "update", { analytics_storage: "denied" });
}

export type AnalyticsEvent =
  | { event: "click_phone"; link_area: string }
  | { event: "click_email"; link_area: string }
  | { event: "click_social"; social_network: string; link_area: string }
  | { event: "generate_lead"; lead_type: "order"; order_mode: string };

/** Pushes an event — but only when the visitor has accepted analytics. */
export function track(payload: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  if (!gtmLoaded || readConsent() !== "granted") return;
  dataLayer().push(payload);
}

/* ------------------------------------------------------ Link detection */

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$|(^|\.)m\.me$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, "whatsapp"],
  [/(^|\.)viber\.com$/, "viber"],
];

export type LinkKind =
  | { kind: "phone" }
  | { kind: "email" }
  | { kind: "social"; network: string };

/** Classifies an href. Never returns the number or address itself. */
export function classifyHref(href: string): LinkKind | null {
  const value = href.trim().toLowerCase();
  if (value.startsWith("tel:")) return { kind: "phone" };
  if (value.startsWith("mailto:")) return { kind: "email" };
  if (value.startsWith("viber:")) return { kind: "social", network: "viber" };

  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  for (const [pattern, network] of SOCIAL_HOSTS) {
    if (pattern.test(host)) return { kind: "social", network };
  }
  return null;
}
