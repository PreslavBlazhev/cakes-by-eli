import { COMPANY_LINE } from "@/lib/company";
import { formatDate, formatPriceOrPending } from "@/lib/format";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PREFERRED_CONTACT_LABELS,
} from "@/lib/labels";
import type { OrderStatus } from "@/lib/labels";
import type { OrderSnapshot } from "@/features/orders/snapshot";
import { snapshotTitle } from "@/features/orders/snapshot";

/**
 * Plain, readable e-mail templates.
 *
 * Every value is escaped before it reaches the HTML body — an order note is
 * customer-controlled text and must never become markup in the owner's inbox.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type OrderEmailData = {
  orderNumber: string;
  orderType: "CATALOG" | "CUSTOM";
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  preferredContact: keyof typeof PREFERRED_CONTACT_LABELS;
  fulfillmentDate: string | null;
  fulfillmentMethod: keyof typeof FULFILLMENT_LABELS;
  occasion: string;
  quantity: number;
  notes: string;
  snapshot: OrderSnapshot | null;
  attachmentCount: number;
  shippingSummary: string | null;
  businessName: string;
  adminUrl: string;
  disclaimer: string;
};

const WRAP_OPEN = `<div style="margin:0;padding:24px;background:#fbf6ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2f211d;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fffdf9;border:1px solid #eadfd3;border-radius:18px;overflow:hidden;">`;

const WRAP_CLOSE = `</table></div>`;

function header(title: string, subtitle: string): string {
  return `<tr><td style="padding:26px 30px;background:#2f211d;color:#fffdf9;">
    <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.72;">${escapeHtml(subtitle)}</div>
    <div style="font-size:24px;margin-top:6px;font-family:Georgia,serif;">${escapeHtml(title)}</div>
  </td></tr>`;
}

function row(label: string, value: string): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:7px 0;color:#6f5b53;font-size:13px;width:170px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function section(title: string, inner: string): string {
  if (!inner.trim()) return "";
  return `<tr><td style="padding:22px 30px 4px;">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8f4e5d;font-weight:700;">${escapeHtml(title)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">${inner}</table>
  </td></tr>`;
}

function configurationRows(snapshot: OrderSnapshot | null): string {
  if (!snapshot) return "";
  return snapshot.lines.map((line) => row(line.group, line.value)).join("");
}

function configurationText(snapshot: OrderSnapshot | null): string {
  if (!snapshot) return "";
  return snapshot.lines.map((line) => `  ${line.group}: ${line.value}`).join("\n");
}

/* ------------------------------------------------------------------ *
 * Owner notification
 * ------------------------------------------------------------------ */

export function ownerOrderEmail(data: OrderEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const title = snapshotTitle(data.snapshot);
  const subject = `Нова поръчка ${data.orderNumber} — ${data.customerName}`;

  const html = `${WRAP_OPEN}
${header(`${title}`, `Нова поръчка · ${data.orderNumber}`)}
${section(
  "Клиент",
  [
    row("Име", data.customerName),
    row("Телефон", data.customerPhone),
    row("Имейл", data.customerEmail),
    row("Предпочитан контакт", PREFERRED_CONTACT_LABELS[data.preferredContact]),
  ].join(""),
)}
${section(
  "Поръчка",
  [
    row("Номер", data.orderNumber),
    row("Тип", ORDER_TYPE_LABELS[data.orderType]),
    row("Десерт", title),
    row("Количество", String(data.quantity)),
    row("Желана дата", data.fulfillmentDate ? formatDate(data.fulfillmentDate) : "не е посочена"),
    row("Повод", data.occasion),
    row("Получаване", FULFILLMENT_LABELS[data.fulfillmentMethod]),
    row(
      "Ориентировъчна цена",
      formatPriceOrPending(data.snapshot?.estimatedPriceCents ?? null),
    ),
  ].join(""),
)}
${section("Конфигурация", configurationRows(data.snapshot))}
${section("Доставка", data.shippingSummary ? row("Данни", data.shippingSummary) : "")}
${section("Бележки от клиента", data.notes ? row("Текст", data.notes) : "")}
${section(
  "Прикачени файлове",
  data.attachmentCount > 0
    ? row("Брой", `${data.attachmentCount} — видими в админ панела`)
    : "",
)}
<tr><td style="padding:24px 30px 30px;">
  <a href="${escapeHtml(data.adminUrl)}" style="display:inline-block;background:#8f4e5d;color:#fffdf9;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700;font-size:14px;">Отвори поръчката в Admin Panel</a>
  <p style="margin:14px 0 0;font-size:12px;color:#9c8a82;">Връзката отваря административния панел и изисква вход с вашия акаунт.</p>
</td></tr>
${WRAP_CLOSE}`;

  const text = [
    `Нова поръчка ${data.orderNumber}`,
    "",
    "КЛИЕНТ",
    `  Име: ${data.customerName}`,
    `  Телефон: ${data.customerPhone}`,
    `  Имейл: ${data.customerEmail}`,
    `  Предпочитан контакт: ${PREFERRED_CONTACT_LABELS[data.preferredContact]}`,
    "",
    "ПОРЪЧКА",
    `  Тип: ${ORDER_TYPE_LABELS[data.orderType]}`,
    `  Десерт: ${title}`,
    `  Количество: ${data.quantity}`,
    `  Желана дата: ${data.fulfillmentDate ? formatDate(data.fulfillmentDate) : "не е посочена"}`,
    data.occasion ? `  Повод: ${data.occasion}` : null,
    `  Получаване: ${FULFILLMENT_LABELS[data.fulfillmentMethod]}`,
    `  Ориентировъчна цена: ${formatPriceOrPending(data.snapshot?.estimatedPriceCents ?? null)}`,
    "",
    data.snapshot?.lines.length ? "КОНФИГУРАЦИЯ" : null,
    data.snapshot?.lines.length ? configurationText(data.snapshot) : null,
    data.shippingSummary ? "" : null,
    data.shippingSummary ? `ДОСТАВКА\n  ${data.shippingSummary}` : null,
    data.notes ? `\nБЕЛЕЖКИ\n  ${data.notes}` : null,
    data.attachmentCount > 0
      ? `\nПрикачени файлове: ${data.attachmentCount} (в админ панела)`
      : null,
    "",
    `Отвори поръчката: ${data.adminUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, html, text };
}

/* ------------------------------------------------------------------ *
 * Customer acknowledgement
 * ------------------------------------------------------------------ */

export function customerOrderEmail(data: OrderEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const title = snapshotTitle(data.snapshot);
  const subject = `Получихме вашето запитване — ${data.orderNumber}`;

  const html = `${WRAP_OPEN}
${header("Получихме вашето запитване", data.businessName)}
<tr><td style="padding:22px 30px 0;">
  <p style="margin:0;font-size:15px;line-height:1.6;color:#6f5b53;">
    Здравейте, ${escapeHtml(data.customerName)}!<br>
    Благодарим ви за запитването. Ще прегледаме детайлите и ще се свържем с вас за потвърждение.
  </p>
</td></tr>
${section(
  "Обобщение",
  [
    row("Номер на поръчка", data.orderNumber),
    row("Десерт", title),
    row("Количество", String(data.quantity)),
    row("Желана дата", data.fulfillmentDate ? formatDate(data.fulfillmentDate) : "не е посочена"),
    row("Повод", data.occasion),
    row("Получаване", FULFILLMENT_LABELS[data.fulfillmentMethod]),
  ].join(""),
)}
${section("Вашата конфигурация", configurationRows(data.snapshot))}
<tr><td style="padding:22px 30px 30px;">
  <div style="background:#f8ecec;border-radius:14px;padding:15px 18px;font-size:13px;color:#743d4a;line-height:1.55;">
    ${escapeHtml(data.disclaimer)}
  </div>
  <p style="margin:16px 0 0;font-size:13px;color:#9c8a82;line-height:1.6;">
    Ако нещо в обобщението не е точно, просто отговорете на този имейл.
  </p>
  <p style="margin:16px 0 0;font-size:12px;color:#9c8a82;line-height:1.6;">
    ${escapeHtml(data.businessName)} · ${escapeHtml(COMPANY_LINE)}
  </p>
</td></tr>
${WRAP_CLOSE}`;

  const text = [
    `Здравейте, ${data.customerName}!`,
    "",
    "Получихме вашето запитване и ще се свържем с вас за потвърждение.",
    "",
    `Номер на поръчка: ${data.orderNumber}`,
    `Десерт: ${title}`,
    `Количество: ${data.quantity}`,
    `Желана дата: ${data.fulfillmentDate ? formatDate(data.fulfillmentDate) : "не е посочена"}`,
    data.occasion ? `Повод: ${data.occasion}` : null,
    `Получаване: ${FULFILLMENT_LABELS[data.fulfillmentMethod]}`,
    "",
    data.snapshot?.lines.length ? "ВАШАТА КОНФИГУРАЦИЯ" : null,
    data.snapshot?.lines.length ? configurationText(data.snapshot) : null,
    "",
    data.disclaimer,
    "",
    data.businessName,
    COMPANY_LINE,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, html, text };
}

/* ------------------------------------------------------------------ *
 * Status change
 * ------------------------------------------------------------------ */

const STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Поръчката ви е потвърдена.",
  READY: "Поръчката ви е готова.",
  SHIPPED: "Поръчката ви е изпратена.",
  CANCELLED: "Поръчката ви е отказана.",
};

export function statusChangeEmail(data: {
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  businessName: string;
  note: string;
  title: string;
  trackingNumber?: string | null;
}): { subject: string; html: string; text: string } | null {
  const message = STATUS_MESSAGES[data.status];
  if (!message) return null;

  const subject = `${message} — ${data.orderNumber}`;

  const html = `${WRAP_OPEN}
${header(message, `${data.businessName} · ${data.orderNumber}`)}
<tr><td style="padding:22px 30px 0;">
  <p style="margin:0;font-size:15px;line-height:1.6;color:#6f5b53;">
    Здравейте, ${escapeHtml(data.customerName)}!<br>
    Статусът на вашата поръчка „${escapeHtml(data.title)}“ е обновен на
    <strong style="color:#2f211d;">${escapeHtml(ORDER_STATUS_LABELS[data.status])}</strong>.
  </p>
</td></tr>
${section(
  "Детайли",
  [
    row("Номер", data.orderNumber),
    row("Статус", ORDER_STATUS_LABELS[data.status]),
    data.trackingNumber ? row("Товарителница Еконт", data.trackingNumber) : "",
  ].join(""),
)}
${
  data.note
    ? `<tr><td style="padding:18px 30px 0;"><div style="background:#f8ecec;border-radius:14px;padding:15px 18px;font-size:13px;color:#743d4a;line-height:1.55;">${escapeHtml(data.note)}</div></td></tr>`
    : ""
}
<tr><td style="padding:24px 30px 30px;font-size:13px;color:#9c8a82;">${escapeHtml(data.businessName)}<br><span style="font-size:12px;">${escapeHtml(COMPANY_LINE)}</span></td></tr>
${WRAP_CLOSE}`;

  const text = [
    `Здравейте, ${data.customerName}!`,
    "",
    `${message}`,
    `Поръчка: ${data.orderNumber} — ${data.title}`,
    `Статус: ${ORDER_STATUS_LABELS[data.status]}`,
    data.trackingNumber ? `Товарителница Еконт: ${data.trackingNumber}` : null,
    data.note ? `\n${data.note}` : null,
    "",
    data.businessName,
    COMPANY_LINE,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, html, text };
}
