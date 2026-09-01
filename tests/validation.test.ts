import { describe, expect, it } from "vitest";

import {
  formatBgPhone,
  formatPrice,
  formatPriceOrPending,
  isoWeekdayInSofia,
  normalizeBgPhone,
  parsePriceToCents,
  todayInSofia,
} from "@/lib/format";
import { slugify, transliterate, uniqueSlug } from "@/lib/slug";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import {
  isDateBlockedForOrders,
  resolveDay,
  todayStatusSentence,
} from "@/lib/schedule";
import {
  orderPayloadSchema,
  sanitizeText,
  sniffImageType,
} from "@/lib/validation";
import { escapeHtml } from "@/lib/email/templates";

describe("phone normalisation", () => {
  it("accepts the spellings Bulgarian customers actually type", () => {
    for (const input of [
      "0878576728",
      "+359878576728",
      "00359878576728",
      "087 857 6728",
      "087-857-6728",
      "359878576728",
    ]) {
      expect(normalizeBgPhone(input)).toBe("+359878576728");
    }
  });

  it("rejects values that cannot be a Bulgarian number", () => {
    for (const input of ["", "123", "abc", "08785767281234"]) {
      expect(normalizeBgPhone(input)).toBeNull();
    }
  });

  it("formats back to the familiar grouping", () => {
    expect(formatBgPhone("+359878576728")).toBe("087 857 6728");
  });
});

describe("money", () => {
  it("formats cents as EUR", () => {
    expect(formatPrice(1590)).toContain("15,90");
  });

  it("falls back to the agreed wording when no price exists", () => {
    expect(formatPriceOrPending(null)).toBe("Цена след уточнение");
  });

  it("parses both comma and dot decimals", () => {
    expect(parsePriceToCents("15,90")).toBe(1590);
    expect(parsePriceToCents("15.90")).toBe(1590);
    expect(parsePriceToCents(" 45 ")).toBe(4500);
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("-5")).toBeNull();
  });
});

describe("slugs", () => {
  it("transliterates Bulgarian to ASCII", () => {
    expect(transliterate("Торти")).toBe("torti");
    expect(slugify("Декорирани бисквити")).toBe("dekorirani-biskviti");
    expect(slugify("Мини торти!!!")).toBe("mini-torti");
  });

  it("keeps slugs unique", () => {
    expect(uniqueSlug("Торти", ["torti"])).toBe("torti-2");
    expect(uniqueSlug("Торти", ["torti", "torti-2"])).toBe("torti-3");
  });
});

describe("dates in Europe/Sofia", () => {
  it("returns a calendar date, not a UTC one", () => {
    // 22:30 UTC on 1 July is already 2 July in Sofia (UTC+3).
    expect(todayInSofia(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });

  it("computes the ISO weekday in local time", () => {
    // 2026-07-02 is a Thursday.
    expect(isoWeekdayInSofia(new Date("2026-07-02T09:00:00Z"))).toBe(4);
  });
});

describe("schedule", () => {
  const hours = [
    { weekday: 1, isClosed: false, opensAt: "09:00:00", closesAt: "18:00:00" },
    { weekday: 2, isClosed: false, opensAt: "09:00:00", closesAt: "18:00:00" },
    { weekday: 3, isClosed: false, opensAt: "09:00:00", closesAt: "18:00:00" },
    { weekday: 4, isClosed: false, opensAt: "09:00:00", closesAt: "18:00:00" },
    { weekday: 5, isClosed: false, opensAt: "09:00:00", closesAt: "18:00:00" },
    { weekday: 6, isClosed: false, opensAt: "10:00:00", closesAt: "14:00:00" },
    { weekday: 7, isClosed: true, opensAt: null, closesAt: null },
  ];

  it("lets an exception override the weekly plan", () => {
    const exceptions = [
      {
        date: "2026-12-24",
        isClosed: false,
        opensAt: "09:00:00",
        closesAt: "14:00:00",
        blocksOrders: false,
        note: "Съкратено работно време",
      },
    ];

    const day = resolveDay("2026-12-24", hours, exceptions);
    expect(day.closesAt).toBe("14:00");
    expect(day.isException).toBe(true);
  });

  it("reports the closing time for an open day", () => {
    // Thursday 12:00 Sofia time.
    const status = todayStatusSentence(hours, [], new Date("2026-07-02T09:00:00Z"));
    expect(status.isOpen).toBe(true);
    expect(status.text).toBe("Днес работим до 18:00");
  });

  it("reports a closed day", () => {
    // Sunday.
    const status = todayStatusSentence(hours, [], new Date("2026-07-05T09:00:00Z"));
    expect(status.isOpen).toBe(false);
    expect(status.text).toBe("Днес не работим");
  });

  it("blocks orders only for dates flagged by the owner", () => {
    const exceptions = [
      {
        date: "2026-12-25",
        isClosed: true,
        opensAt: null,
        closesAt: null,
        blocksOrders: true,
        note: "Коледа",
      },
    ];

    expect(isDateBlockedForOrders("2026-12-25", exceptions).blocked).toBe(true);
    expect(isDateBlockedForOrders("2026-12-26", exceptions).blocked).toBe(false);
  });
});

describe("order payload validation", () => {
  const valid = {
    orderType: "CATALOG" as const,
    productId: "0f9ac1d0-1c4b-4f2f-9f8f-6e0f3f2b7a11",
    quantity: 2,
    customerName: "Иван Петров",
    customerPhone: "0888123456",
    customerEmail: "ivan@example.com",
    consent: true as const,
  };

  it("accepts a complete catalogue order", () => {
    expect(orderPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("requires consent", () => {
    const result = orderPayloadSchema.safeParse({ ...valid, consent: false });
    expect(result.success).toBe(false);
  });

  it("requires a product for a catalogue order", () => {
    const { productId: _productId, ...rest } = valid;
    const result = orderPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("requires a dessert type for a custom order", () => {
    const result = orderPayloadSchema.safeParse({
      ...valid,
      orderType: "CUSTOM",
      productId: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("requires an office when delivering to an Econt office", () => {
    const result = orderPayloadSchema.safeParse({
      ...valid,
      fulfillmentMethod: "ECONT_OFFICE",
      shipping: { recipientName: "Иван" },
    });
    expect(result.success).toBe(false);
  });

  it("requires either a street with number or a free-text address", () => {
    const missing = orderPayloadSchema.safeParse({
      ...valid,
      fulfillmentMethod: "ECONT_ADDRESS",
      shipping: { recipientName: "Иван", cityName: "София" },
    });
    expect(missing.success).toBe(false);

    const withOther = orderPayloadSchema.safeParse({
      ...valid,
      fulfillmentMethod: "ECONT_ADDRESS",
      shipping: {
        recipientName: "Иван",
        cityName: "София",
        other: "бл. 5, вх. А",
      },
    });
    expect(withOther.success).toBe(true);
  });

  it("rejects an invalid e-mail and an invalid phone", () => {
    expect(
      orderPayloadSchema.safeParse({ ...valid, customerEmail: "nope" }).success,
    ).toBe(false);
    expect(
      orderPayloadSchema.safeParse({ ...valid, customerPhone: "12" }).success,
    ).toBe(false);
  });
});

describe("upload sniffing", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
  ]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);

  it("recognises the allowed formats by their bytes", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects a file that only claims to be an image", () => {
    // An SVG or a script renamed to .jpg has no matching signature.
    const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    expect(sniffImageType(svg)).toBeNull();
  });
});

describe("text hardening", () => {
  it("strips control characters but keeps normal whitespace", () => {
    const dirty = `Торта${String.fromCharCode(0)}\nс ягоди `;
    expect(sanitizeText(dirty)).toBe("Торта\nс ягоди");
  });

  it("escapes markup before it reaches an e-mail body", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
    );
  });
});

describe("rate limiting", () => {
  it("allows up to the limit and then blocks", () => {
    resetRateLimit("test-bucket");

    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("test-bucket", { limit: 3, windowMs: 1000 }).allowed).toBe(
        true,
      );
    }

    const blocked = rateLimit("test-bucket", { limit: 3, windowMs: 1000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
