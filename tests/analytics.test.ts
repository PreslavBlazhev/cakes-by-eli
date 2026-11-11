import { describe, expect, it } from "vitest";

import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  classifyHref,
  parseConsentCookie,
  track,
} from "@/lib/analytics";

describe("parseConsentCookie", () => {
  it("reads a granted or denied choice", () => {
    expect(
      parseConsentCookie(`a=1; ${CONSENT_COOKIE}=${CONSENT_VERSION}:granted; b=2`),
    ).toBe("granted");
    expect(
      parseConsentCookie(`${CONSENT_COOKIE}=${CONSENT_VERSION}%3Adenied`),
    ).toBe("denied");
  });

  it("asks again when there is no choice, a stale version or junk", () => {
    expect(parseConsentCookie("")).toBeNull();
    expect(parseConsentCookie(`${CONSENT_COOKIE}=0:granted`)).toBeNull();
    expect(parseConsentCookie(`${CONSENT_COOKIE}=${CONSENT_VERSION}:maybe`)).toBeNull();
    expect(parseConsentCookie(`x${CONSENT_COOKIE}=${CONSENT_VERSION}:granted`)).toBeNull();
  });
});

describe("classifyHref", () => {
  it("recognises phone and e-mail links without exposing them", () => {
    expect(classifyHref("tel:+359878576728")).toEqual({ kind: "phone" });
    expect(classifyHref("mailto:hello@example.bg")).toEqual({ kind: "email" });
  });

  it("names the social network", () => {
    expect(classifyHref("https://www.facebook.com/chokolateatelieEli")).toEqual({
      kind: "social",
      network: "facebook",
    });
    expect(classifyHref("https://instagram.com/cakes_byeli_")).toEqual({
      kind: "social",
      network: "instagram",
    });
    expect(classifyHref("https://www.tiktok.com/@x")).toEqual({
      kind: "social",
      network: "tiktok",
    });
  });

  it("ignores ordinary links and look-alike hosts", () => {
    expect(classifyHref("/menu")).toBeNull();
    expect(classifyHref("https://example.bg/facebook.com")).toBeNull();
    expect(classifyHref("https://notfacebook.com/")).toBeNull();
    expect(classifyHref("#main")).toBeNull();
  });
});

describe("track", () => {
  it("is a no-op outside the browser", () => {
    expect(() => track({ event: "click_phone", link_area: "header" })).not.toThrow();
  });
});
