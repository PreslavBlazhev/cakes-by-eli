/**
 * Types for the Econt Delivery API (ee.econt.com / demo.econt.com).
 *
 * Only the fields this application actually sends or reads are modelled; the
 * API returns considerably more and unknown keys are simply ignored.
 */

export type EcontCountry = {
  id?: number;
  code2?: string;
  code3?: string;
  name?: string;
  nameEn?: string;
  isEU?: boolean;
};

export type EcontCity = {
  id: number;
  country?: EcontCountry;
  postCode?: string;
  name: string;
  nameEn?: string;
  regionName?: string | null;
  expressCityDeliveries?: boolean | null;
};

export type EcontAddress = {
  id?: number;
  city: { id?: number; country?: EcontCountry; postCode?: string; name?: string };
  fullAddress?: string | null;
  quarter?: string | null;
  street?: string | null;
  num?: string | null;
  other?: string | null;
  zip?: string | null;
};

export type EcontOffice = {
  id: number;
  code: string;
  name: string;
  nameEn?: string;
  isMPS?: boolean;
  isAPS?: boolean;
  phones?: string[];
  address?: EcontAddress;
  normalBusinessHoursFrom?: number | null;
  normalBusinessHoursTo?: number | null;
};

export type EcontClient = {
  name: string;
  phones: string[];
  email?: string;
};

/** Fields of `ShippingLabel` that this application sets. */
export type EcontLabelRequest = {
  senderClient: EcontClient;
  senderAgent?: EcontClient;
  senderAddress?: EcontAddress;
  senderOfficeCode?: string;

  receiverClient: EcontClient;
  receiverAddress?: EcontAddress;
  receiverOfficeCode?: string;

  packCount: number;
  shipmentType: EcontShipmentType;
  weight: number;
  shipmentDescription: string;

  sizeUnder65cm?: boolean;
  keepUpright?: boolean;
  holidayDeliveryDay?: string;
  instructions?: unknown[];

  paymentSenderMethod?: "cash" | "credit";
  paymentReceiverMethod?: "cash" | "credit";

  services?: {
    declaredValueAmount?: number;
    declaredValueCurrency?: string;
    cdAmount?: number;
    cdType?: "get" | "give";
    cdCurrency?: string;
  };
};

export type EcontShipmentType =
  | "PACK"
  | "DOCUMENT"
  | "PALLET"
  | "CARGO"
  | "BIG_LETTER"
  | "SMALL_LETTER";

export type EcontLabelResponse = {
  label?: {
    shipmentNumber?: string | null;
    pdfURL?: string | null;
    totalPrice?: number | null;
    currency?: string | null;
    expectedDeliveryDate?: number | null;
    senderDueAmount?: number | null;
    receiverDueAmount?: number | null;
    services?: {
      type?: string;
      description?: string;
      price?: number;
      currency?: string;
    }[];
    trackingEvents?: unknown[];
    shipmentDescription?: string | null;
  } | null;
  blockingPaymentURL?: string | null;
  courierRequestID?: number | null;
};

export type EcontApiError = {
  type?: string;
  message?: string;
  fields?: string[];
  innerErrors?: EcontApiError[];
};

export type EcontShipmentStatus = {
  shipmentNumber?: string;
  status?: string;
  shortDeliveryStatus?: string | null;
  expectedDeliveryDate?: number | null;
  trackingEvents?: {
    destinationDetails?: string;
    destinationType?: string;
    time?: number;
    officeName?: string;
    isReceipt?: boolean;
  }[];
};

export type EcontEnvironment = "demo" | "production";
