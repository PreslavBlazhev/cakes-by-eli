import { env } from "@/lib/env";
import { econtCall, EcontError } from "./client";
import type {
  EcontAddress,
  EcontLabelRequest,
  EcontLabelResponse,
  EcontShipmentStatus,
  EcontShipmentType,
} from "./types";

/**
 * Shipment (waybill) operations.
 *
 * `mode` selects what Econt actually does:
 *   validate  — check the data, create nothing
 *   calculate — price the shipment, create nothing
 *   create    — issue a real waybill and return its number and label PDF
 */
export type LabelMode = "validate" | "calculate" | "create";

export type ShipmentInput = {
  receiverName: string;
  receiverPhone: string;
  receiverEmail?: string;

  /** Office delivery. */
  officeCode?: string;

  /** Address delivery. */
  cityId?: number;
  cityName?: string;
  postCode?: string;
  quarter?: string;
  street?: string;
  streetNum?: string;
  other?: string;

  packCount: number;
  weightKg: number;
  description: string;
  shipmentType?: EcontShipmentType;
  keepUpright?: boolean;
  sizeUnder65cm?: boolean;
  declaredValueEur?: number | null;
  /** Cash on delivery, in EUR. */
  codAmountEur?: number | null;
  payer?: "sender" | "receiver";
};

export type ShipmentOutcome = {
  shipmentNumber: string | null;
  pdfUrl: string | null;
  totalPriceCents: number | null;
  currency: string | null;
  expectedDeliveryDate: Date | null;
  services: { description: string; price: number; currency: string }[];
  request: EcontLabelRequest;
  response: EcontLabelResponse;
};

/** Builds the sender block from environment configuration. */
function senderBlocks(): Pick<
  EcontLabelRequest,
  "senderClient" | "senderAgent" | "senderAddress" | "senderOfficeCode"
> {
  if (!env.ECONT_SENDER_NAME || !env.ECONT_SENDER_PHONE) {
    throw new EcontError(
      "Данните на подателя не са конфигурирани. Попълнете ECONT_SENDER_NAME и ECONT_SENDER_PHONE.",
      { type: "SenderNotConfigured" },
    );
  }

  const senderClient = {
    name: env.ECONT_SENDER_NAME,
    phones: [env.ECONT_SENDER_PHONE],
  };

  const senderAgent = env.ECONT_SENDER_AGENT_NAME
    ? { name: env.ECONT_SENDER_AGENT_NAME, phones: [env.ECONT_SENDER_PHONE] }
    : undefined;

  if (env.ECONT_SENDER_OFFICE_CODE) {
    return {
      senderClient,
      senderAgent,
      senderOfficeCode: env.ECONT_SENDER_OFFICE_CODE,
    };
  }

  if (!env.ECONT_SENDER_CITY_ID || !env.ECONT_SENDER_CITY_NAME) {
    throw new EcontError(
      "Адресът на подателя не е конфигуриран. Попълнете ECONT_SENDER_CITY_ID и ECONT_SENDER_CITY_NAME (или ECONT_SENDER_OFFICE_CODE).",
      { type: "SenderNotConfigured" },
    );
  }

  const senderAddress: EcontAddress = {
    city: {
      id: env.ECONT_SENDER_CITY_ID,
      country: { code3: "BGR" },
      name: env.ECONT_SENDER_CITY_NAME,
      postCode: env.ECONT_SENDER_POST_CODE,
    },
    quarter: env.ECONT_SENDER_QUARTER,
    street: env.ECONT_SENDER_STREET,
    num: env.ECONT_SENDER_STREET_NUM,
    other: env.ECONT_SENDER_OTHER,
  };

  return { senderClient, senderAgent, senderAddress };
}

export function buildLabelRequest(input: ShipmentInput): EcontLabelRequest {
  const sender = senderBlocks();

  const receiverClient = {
    name: input.receiverName,
    phones: [input.receiverPhone],
    email: input.receiverEmail,
  };

  const base: EcontLabelRequest = {
    ...sender,
    receiverClient,
    packCount: Math.max(1, Math.round(input.packCount)),
    shipmentType: input.shipmentType ?? "PACK",
    weight: Math.max(0.1, Number(input.weightKg.toFixed(2))),
    shipmentDescription: input.description.slice(0, 250),
    keepUpright: input.keepUpright ?? true,
    sizeUnder65cm: input.sizeUnder65cm ?? false,
    paymentSenderMethod:
      (input.payer ?? "sender") === "sender" ? "cash" : undefined,
    paymentReceiverMethod:
      (input.payer ?? "sender") === "receiver" ? "cash" : undefined,
  };

  if (input.officeCode) {
    base.receiverOfficeCode = input.officeCode;
  } else {
    base.receiverAddress = {
      city: {
        id: input.cityId,
        country: { code3: "BGR" },
        name: input.cityName,
        postCode: input.postCode,
      },
      quarter: input.quarter || undefined,
      street: input.street || undefined,
      num: input.streetNum || undefined,
      other: input.other || undefined,
    };
  }

  const services: NonNullable<EcontLabelRequest["services"]> = {};
  if (input.declaredValueEur && input.declaredValueEur > 0) {
    services.declaredValueAmount = input.declaredValueEur;
    services.declaredValueCurrency = "EUR";
  }
  if (input.codAmountEur && input.codAmountEur > 0) {
    services.cdAmount = input.codAmountEur;
    services.cdType = "get";
    services.cdCurrency = "EUR";
  }
  if (Object.keys(services).length > 0) base.services = services;

  return base;
}

export async function submitLabel(
  input: ShipmentInput,
  mode: LabelMode,
): Promise<ShipmentOutcome> {
  const request = buildLabelRequest(input);

  const response = await econtCall<EcontLabelResponse>(
    "Shipments/LabelService.createLabel",
    { label: request, mode },
  );

  const label = response.label ?? {};

  return {
    shipmentNumber: label.shipmentNumber || null,
    pdfUrl: label.pdfURL || null,
    totalPriceCents:
      typeof label.totalPrice === "number"
        ? Math.round(label.totalPrice * 100)
        : null,
    currency: label.currency ?? null,
    expectedDeliveryDate: label.expectedDeliveryDate
      ? new Date(label.expectedDeliveryDate)
      : null,
    services: (label.services ?? []).map((service) => ({
      description: service.description ?? "",
      price: service.price ?? 0,
      currency: service.currency ?? "EUR",
    })),
    request,
    response,
  };
}

/** Prices a shipment without creating anything. */
export function calculateShipment(input: ShipmentInput) {
  return submitLabel(input, "calculate");
}

/** Checks the data without creating anything. */
export function validateShipment(input: ShipmentInput) {
  return submitLabel(input, "validate");
}

/** Issues a real waybill. */
export function createShipment(input: ShipmentInput) {
  return submitLabel(input, "create");
}

export async function getShipmentStatuses(
  shipmentNumbers: string[],
): Promise<EcontShipmentStatus[]> {
  const response = await econtCall<{
    shipmentStatuses?: { status?: EcontShipmentStatus; error?: unknown }[];
  }>("Shipments/ShipmentService.getShipmentStatuses", { shipmentNumbers });

  return (response.shipmentStatuses ?? [])
    .map((entry) => entry.status)
    .filter((status): status is EcontShipmentStatus => Boolean(status));
}

export async function deleteShipments(
  shipmentNumbers: string[],
): Promise<void> {
  await econtCall("Shipments/LabelService.deleteLabels", { shipmentNumbers });
}

/** Direct link to the public tracking page. */
export function trackingUrl(shipmentNumber: string): string {
  return `https://www.econt.com/services/track-shipment/${encodeURIComponent(shipmentNumber)}`;
}
