import type {
  availabilityEnum,
  fulfillmentMethodEnum,
  orderStatusEnum,
  orderTypeEnum,
  preferredContactEnum,
} from "@/db/schema";

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type FulfillmentMethod =
  (typeof fulfillmentMethodEnum.enumValues)[number];
export type PreferredContact =
  (typeof preferredContactEnum.enumValues)[number];
export type ProductAvailability = (typeof availabilityEnum.enumValues)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Нова",
  REVIEWING: "За преглед",
  AWAITING_CUSTOMER: "Чака клиента",
  CONFIRMED: "Потвърдена",
  IN_PRODUCTION: "В изработка",
  READY: "Готова",
  SHIPPED: "Изпратена",
  COMPLETED: "Приключена",
  CANCELLED: "Отказана",
};

/** Drives the coloured status pill in the admin UI. */
export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "new" | "progress" | "positive" | "muted" | "danger"
> = {
  NEW: "new",
  REVIEWING: "progress",
  AWAITING_CUSTOMER: "progress",
  CONFIRMED: "positive",
  IN_PRODUCTION: "progress",
  READY: "positive",
  SHIPPED: "progress",
  COMPLETED: "muted",
  CANCELLED: "danger",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "NEW",
  "REVIEWING",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

/** Statuses whose transition can notify the customer by e-mail. */
export const CUSTOMER_NOTIFIABLE_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "READY",
  "SHIPPED",
  "CANCELLED",
];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  CATALOG: "Готов продукт",
  CUSTOM: "Персонална поръчка",
};

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  PICKUP: "Вземане на място",
  ECONT_OFFICE: "Доставка до офис на Еконт",
  ECONT_ADDRESS: "Доставка до адрес с Еконт",
};

export const FULFILLMENT_SHORT: Record<FulfillmentMethod, string> = {
  PICKUP: "На място",
  ECONT_OFFICE: "Еконт офис",
  ECONT_ADDRESS: "Еконт адрес",
};

export const PREFERRED_CONTACT_LABELS: Record<PreferredContact, string> = {
  PHONE: "Телефонно обаждане",
  EMAIL: "Имейл",
  VIBER: "Viber / съобщение",
};

export const AVAILABILITY_LABELS: Record<ProductAvailability, string> = {
  ACTIVE: "Активен",
  UNAVAILABLE: "Временно неналичен",
  SEASONAL: "Сезонен",
  HIDDEN: "Скрит",
};

/** Only these can be ordered by a customer — enforced server-side. */
export const ORDERABLE_AVAILABILITY: ProductAvailability[] = [
  "ACTIVE",
  "SEASONAL",
];

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Понеделник",
  2: "Вторник",
  3: "Сряда",
  4: "Четвъртък",
  5: "Петък",
  6: "Събота",
  7: "Неделя",
};

export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Пон",
  2: "Вт",
  3: "Ср",
  4: "Чет",
  5: "Пет",
  6: "Съб",
  7: "Нед",
};
