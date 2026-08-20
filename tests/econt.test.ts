import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Econt adapter is exercised against a mocked transport.
 *
 * Automated tests must never create a real waybill, so `fetch` is stubbed and
 * the assertions cover exactly the two things that were hardest to get right
 * against the live demo API: the UTF-8 content type, and turning the nested
 * error tree into something the owner can read.
 */

const ENV = {
  ECONT_ENVIRONMENT: "demo",
  ECONT_USERNAME: "iasp-dev",
  ECONT_PASSWORD: "1Asp-dev",
  ECONT_SENDER_NAME: "Cakes by ELI",
  ECONT_SENDER_PHONE: "0878576728",
  ECONT_SENDER_AGENT_NAME: "Ели",
  ECONT_SENDER_CITY_ID: "32",
  ECONT_SENDER_CITY_NAME: "Плевен",
  ECONT_SENDER_POST_CODE: "5800",
  ECONT_SENDER_STREET: "ул. Васил Левски",
  ECONT_SENDER_STREET_NUM: "1",
};

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: {
  status?: number;
  body: unknown;
}): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () =>
    new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("request shape", () => {
  it("declares UTF-8 so Cyrillic survives the round trip", async () => {
    const spy = stubFetch({ body: { label: { shipmentNumber: "1" } } });
    const { createShipment } = await import("@/lib/econt/shipments");

    await createShipment({
      receiverName: "Иван Петров",
      receiverPhone: "0888123456",
      officeCode: "1010",
      packCount: 1,
      weightKg: 3.5,
      description: "Торта",
    });

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("demo.econt.com");
    expect(
      (init.headers as Record<string, string>)["Content-Type"],
    ).toBe("application/json; charset=utf-8");
  });

  it("sends basic auth credentials", async () => {
    const spy = stubFetch({ body: { label: {} } });
    const { calculateShipment } = await import("@/lib/econt/shipments");

    await calculateShipment({
      receiverName: "Иван",
      receiverPhone: "0888123456",
      officeCode: "1010",
      packCount: 1,
      weightKg: 1,
      description: "Еклери",
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(Buffer.from(auth.replace("Basic ", ""), "base64").toString()).toBe(
      "iasp-dev:1Asp-dev",
    );
  });

  it("maps an office delivery onto receiverOfficeCode", async () => {
    const spy = stubFetch({ body: { label: {} } });
    const { validateShipment } = await import("@/lib/econt/shipments");

    await validateShipment({
      receiverName: "Иван",
      receiverPhone: "0888123456",
      officeCode: "1010",
      packCount: 2,
      weightKg: 2.4,
      description: "Макарони",
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.mode).toBe("validate");
    expect(payload.label.receiverOfficeCode).toBe("1010");
    expect(payload.label.receiverAddress).toBeUndefined();
    expect(payload.label.packCount).toBe(2);
    expect(payload.label.weight).toBe(2.4);
    expect(payload.label.keepUpright).toBe(true);
  });

  it("maps an address delivery onto receiverAddress with the city id", async () => {
    const spy = stubFetch({ body: { label: {} } });
    const { createShipment } = await import("@/lib/econt/shipments");

    await createShipment({
      receiverName: "Иван",
      receiverPhone: "0888123456",
      cityId: 41,
      cityName: "София",
      postCode: "1000",
      street: "ул. Иван Вазов",
      streetNum: "8",
      packCount: 1,
      weightKg: 3.5,
      description: "Торта",
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.label.receiverOfficeCode).toBeUndefined();
    expect(payload.label.receiverAddress.city.id).toBe(41);
    expect(payload.label.receiverAddress.city.country.code3).toBe("BGR");
    expect(payload.label.receiverAddress.street).toBe("ул. Иван Вазов");
  });

  it("includes the sender agent required for a legal entity", async () => {
    const spy = stubFetch({ body: { label: {} } });
    const { createShipment } = await import("@/lib/econt/shipments");

    await createShipment({
      receiverName: "Иван",
      receiverPhone: "0888123456",
      officeCode: "1010",
      packCount: 1,
      weightKg: 1,
      description: "Бисквити",
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.label.senderAgent.name).toBe("Ели");
    expect(payload.label.senderAddress.city.id).toBe(32);
  });

  it("adds declared value and cash on delivery only when asked", async () => {
    const spy = stubFetch({ body: { label: {} } });
    const { createShipment } = await import("@/lib/econt/shipments");

    await createShipment({
      receiverName: "Иван",
      receiverPhone: "0888123456",
      officeCode: "1010",
      packCount: 1,
      weightKg: 1,
      description: "Торта",
      declaredValueEur: 60,
      codAmountEur: 60,
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.label.services).toEqual({
      declaredValueAmount: 60,
      declaredValueCurrency: "EUR",
      cdAmount: 60,
      cdType: "get",
      cdCurrency: "EUR",
    });
  });
});

describe("response handling", () => {
  it("extracts the shipment number, label URL and price", async () => {
    stubFetch({
      body: {
        label: {
          shipmentNumber: "1051604234826",
          pdfURL: "https://demo.econt.com/label.pdf",
          totalPrice: 7.25,
          currency: "EUR",
          expectedDeliveryDate: 1787173200000,
          services: [
            { description: "Куриерска услуга", price: 7.25, currency: "EUR" },
          ],
        },
      },
    });

    const { createShipment } = await import("@/lib/econt/shipments");
    const outcome = await createShipment({
      receiverName: "Иван",
      receiverPhone: "0888123456",
      officeCode: "1010",
      packCount: 1,
      weightKg: 3.5,
      description: "Торта",
    });

    expect(outcome.shipmentNumber).toBe("1051604234826");
    expect(outcome.pdfUrl).toBe("https://demo.econt.com/label.pdf");
    expect(outcome.totalPriceCents).toBe(725);
    expect(outcome.currency).toBe("EUR");
    expect(outcome.expectedDeliveryDate).toBeInstanceOf(Date);
    expect(outcome.services).toHaveLength(1);
  });

  it("flattens the nested error tree into readable lines", async () => {
    stubFetch({
      status: 517,
      body: {
        type: "ExInvalidParam",
        message: " ",
        innerErrors: [
          {
            type: "ExInvalidParam",
            message: "получател: ",
            innerErrors: [
              {
                type: "ExInvalidAddress",
                message:
                  "Информацията, която попълнихте за адрес, е недостатъчна.",
                innerErrors: [],
              },
            ],
          },
        ],
      },
    });

    const { createShipment } = await import("@/lib/econt/shipments");
    const { EcontError } = await import("@/lib/econt/client");

    await expect(
      createShipment({
        receiverName: "Иван",
        receiverPhone: "0888123456",
        cityId: 41,
        cityName: "София",
        packCount: 1,
        weightKg: 1,
        description: "Торта",
      }),
    ).rejects.toThrow(EcontError);

    try {
      await createShipment({
        receiverName: "Иван",
        receiverPhone: "0888123456",
        cityId: 41,
        cityName: "София",
        packCount: 1,
        weightKg: 1,
        description: "Торта",
      });
    } catch (error) {
      const econtError = error as InstanceType<
        Awaited<typeof import("@/lib/econt/client")>["EcontError"]
      >;
      expect(econtError.details[0]).toBe(
        "получател — Информацията, която попълнихте за адрес, е недостатъчна.",
      );
    }
  });

  it("reports a credentials problem distinctly", async () => {
    stubFetch({ status: 401, body: {} });

    const { calculateShipment } = await import("@/lib/econt/shipments");

    await expect(
      calculateShipment({
        receiverName: "Иван",
        receiverPhone: "0888123456",
        officeCode: "1010",
        packCount: 1,
        weightKg: 1,
        description: "Торта",
      }),
    ).rejects.toThrow(/ECONT_USERNAME/);
  });
});

describe("configuration guards", () => {
  it("refuses to call the API without credentials", async () => {
    delete process.env.ECONT_USERNAME;
    delete process.env.ECONT_PASSWORD;
    vi.resetModules();

    const spy = stubFetch({ body: {} });
    const { calculateShipment } = await import("@/lib/econt/shipments");

    await expect(
      calculateShipment({
        receiverName: "Иван",
        receiverPhone: "0888123456",
        officeCode: "1010",
        packCount: 1,
        weightKg: 1,
        description: "Торта",
      }),
    ).rejects.toThrow(/не е конфигурирана/);

    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses to build a label without a sender address", async () => {
    delete process.env.ECONT_SENDER_CITY_ID;
    delete process.env.ECONT_SENDER_OFFICE_CODE;
    vi.resetModules();

    stubFetch({ body: {} });
    const { createShipment } = await import("@/lib/econt/shipments");

    await expect(
      createShipment({
        receiverName: "Иван",
        receiverPhone: "0888123456",
        officeCode: "1010",
        packCount: 1,
        weightKg: 1,
        description: "Торта",
      }),
    ).rejects.toThrow(/ECONT_SENDER_CITY_ID/);
  });
});
