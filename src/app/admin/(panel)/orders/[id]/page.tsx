import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Mail,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";

import { ConfirmAction } from "@/components/admin/ActionForm";
import { CopyButton } from "@/components/admin/CopyButton";
import { OrderPreview } from "@/components/admin/OrderPreview";
import { Card, DefinitionList, PageHeader, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { EcontPanel } from "./EcontPanel";
import { NotesPanel } from "./NotesPanel";
import { ShippingForm } from "./ShippingForm";
import { StatusControl } from "./StatusControl";
import type { ConfigState } from "@/features/configurator/types";
import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { econtEnvironment } from "@/lib/econt/client";
import { econtReadiness } from "@/lib/econt/readiness";
import { env } from "@/lib/env";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatPriceOrPending,
} from "@/lib/format";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PREFERRED_CONTACT_LABELS,
} from "@/lib/labels";
import { regenerateQrToken } from "@/server/admin/orders";
import { getDessertConfigById } from "@/server/queries/configurator";
import { getOrder } from "@/server/queries/orders";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const data = await getOrder(id);
  return { title: data ? data.order.orderNumber : "Поръчка" };
}

export default async function AdminOrderPage({ params }: Params) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();

  const { order, attachments, history, notes, emails, shipments } = data;
  const snapshot = readSnapshot(order.snapshot);
  const title = snapshotTitle(snapshot);

  const dessert = order.dessertTypeId
    ? await getDessertConfigById(order.dessertTypeId, { activeOnly: false })
    : null;

  const qrUrl = `${env.APP_URL}/order-summary/${order.qrToken}`;
  const qrSvg = await QRCode.toString(qrUrl, {
    type: "svg",
    margin: 1,
    width: 168,
    color: { dark: "#2f211d", light: "#fffdf9" },
  });

  const failedEmails = emails.filter((email) => email.status !== "SENT");

  // Checked only where a waybill can actually be issued.
  const econtState =
    order.fulfillmentMethod === "PICKUP" ? null : await econtReadiness();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/orders", label: "Всички поръчки" }}
        title={order.orderNumber}
        description={`${title} · получена ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            <StatusBadge status={order.status} />
            <Link
              href={`/admin/print/${order.id}`}
              target="_blank"
              className="inline-flex min-h-10 items-center gap-2 rounded-[3px] border border-line bg-paper px-4 text-[0.86rem] font-semibold transition-colors hover:border-ink"
            >
              <Printer size={15} aria-hidden="true" />
              Принтирай поръчка
            </Link>
          </>
        }
      />

      {failedEmails.length > 0 ? (
        <div className="mb-5 flex items-start gap-2 rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft px-4 py-3 text-[0.86rem] text-warning">
          <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 flex-none" />
          <div>
            <p className="font-bold">Част от имейлите не са изпратени</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {failedEmails.map((email) => (
                <li key={email.id}>
                  {email.kind === "OWNER_NEW_ORDER"
                    ? "Известие до вас"
                    : "Съобщение до клиента"}
                  : {email.error ?? "неуспешно"}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">
              Тези писма не се изпращат повторно автоматично. Ако е нужно,
              свържете се с клиента по телефон или имейл.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* ------------------------------------------------ Left column */}
        <div className="space-y-4">
          <Card title="Клиент">
            <DefinitionList
              items={[
                { label: "Име", value: order.customerName },
                {
                  label: "Телефон",
                  value: (
                    <a
                      href={`tel:${order.customerPhoneE164}`}
                      className="hover:text-rose-dark"
                    >
                      {order.customerPhone}
                    </a>
                  ),
                },
                {
                  label: "Имейл",
                  value: (
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="hover:text-rose-dark"
                    >
                      {order.customerEmail}
                    </a>
                  ),
                },
                {
                  label: "Предпочитан контакт",
                  value: PREFERRED_CONTACT_LABELS[order.preferredContact],
                },
              ]}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={order.customerPhone} label="Копирай телефон" />
              <CopyButton value={order.customerEmail} label="Копирай имейл" />
              <a
                href={`tel:${order.customerPhoneE164}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-[3px] border border-line bg-paper px-3 text-[0.8rem] font-semibold transition-colors hover:border-ink"
              >
                <Phone size={13} aria-hidden="true" />
                Обади се
              </a>
              <a
                href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(
                  `Поръчка ${order.orderNumber}`,
                )}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-[3px] border border-line bg-paper px-3 text-[0.8rem] font-semibold transition-colors hover:border-ink"
              >
                <Mail size={13} aria-hidden="true" />
                Напиши имейл
              </a>
            </div>
          </Card>

          <Card title="Заявка">
            <DefinitionList
              items={[
                { label: "Тип поръчка", value: ORDER_TYPE_LABELS[order.orderType] },
                { label: "Десерт", value: title },
                { label: "Количество", value: String(order.quantity) },
                {
                  label: "Желана дата",
                  value: formatDate(order.fulfillmentDate),
                },
                { label: "Повод", value: order.occasion || "—" },
                {
                  label: "Получаване",
                  value: FULFILLMENT_LABELS[order.fulfillmentMethod],
                },
                {
                  label: "Ориентировъчна цена",
                  value: formatPriceOrPending(order.estimatedPriceCents),
                },
              ]}
            />

            {order.notes ? (
              <div className="mt-4 rounded-[var(--radius-sm)] bg-surface-sunk px-4 py-3">
                <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.1em] text-ink-faint">
                  Бележка от клиента
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[0.9rem]">
                  {order.notes}
                </p>
              </div>
            ) : null}
          </Card>

          {/* ------------------------------------- Production summary */}
          <Card
            title="За изработка"
            description="Кратко и четимо — за кухнята."
          >
            <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="font-mono text-[0.92rem] leading-relaxed">
                <p className="text-[1.05rem] font-bold">
                  {formatDate(order.fulfillmentDate)}
                </p>
                <p className="mt-2 text-[1.05rem]">{title}</p>
                {order.quantity > 1 ? <p>Количество: {order.quantity}</p> : null}

                {snapshot?.lines.length ? (
                  <dl className="mt-3 space-y-1">
                    {snapshot.lines.map((line) => (
                      <div key={line.groupKey} className="flex gap-2">
                        <dt className="min-w-[110px] text-ink-faint">
                          {line.group}:
                        </dt>
                        <dd className="font-semibold">{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>

              {dessert && order.configState ? (
                <div className="w-full sm:w-[220px]">
                  <OrderPreview
                    dessert={dessert}
                    configState={order.configState as ConfigState}
                  />
                  <p className="mt-1 text-center text-[0.72rem] text-ink-faint">
                    Визуализация от конфигуратора
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          {attachments.length > 0 ? (
            <Card
              title="Прикачени снимки"
              description="Изпратени от клиента като идея за вдъхновение."
            >
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={attachment.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block overflow-hidden rounded-[var(--radius-sm)] border border-line"
                    >
                      <span className="relative block aspect-[4/3] bg-surface-sunk">
                        <Image
                          src={attachment.path}
                          alt={attachment.originalName}
                          fill
                          sizes="(max-width: 640px) 50vw, 220px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </span>
                      <span className="block px-2.5 py-2">
                        <span className="block truncate text-[0.76rem] font-semibold">
                          {attachment.originalName}
                        </span>
                        <span className="block text-[0.7rem] text-ink-faint">
                          {formatBytes(attachment.sizeBytes)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {order.fulfillmentMethod !== "PICKUP" ? (
            <>
              <Card
                title="Данни за доставка"
                description="Попълнени от клиента при поръчката."
              >
                <DefinitionList
                  items={[
                    {
                      label: "Получател",
                      value: order.shipRecipientName || order.customerName,
                    },
                    {
                      label: "Телефон",
                      value: order.shipRecipientPhone || order.customerPhone,
                    },
                    {
                      label: "Населено място",
                      value: order.shipCityName
                        ? `${order.shipCityName}${order.shipPostCode ? ` (${order.shipPostCode})` : ""}`
                        : "—",
                    },
                    order.fulfillmentMethod === "ECONT_OFFICE"
                      ? {
                          label: "Офис",
                          value:
                            order.shipOfficeName ||
                            order.shipOfficeCode ||
                            "—",
                        }
                      : {
                          label: "Адрес",
                          value:
                            [
                              order.shipQuarter,
                              order.shipStreet,
                              order.shipStreetNum,
                              order.shipOther,
                            ]
                              .filter(Boolean)
                              .join(", ") || "—",
                        },
                  ]}
                />
              </Card>

              <Card
                title="Подготовка на пратката"
                description="Проверете теглото и размерите преди да създадете товарителница."
              >
                <ShippingForm
                  orderId={order.id}
                  defaults={{
                    shippingWeightKg: order.shippingWeightKg ?? "1.00",
                    shippingLengthCm: String(order.shippingLengthCm ?? 30),
                    shippingWidthCm: String(order.shippingWidthCm ?? 30),
                    shippingHeightCm: String(order.shippingHeightCm ?? 20),
                    packageCount: String(order.packageCount ?? 1),
                    shippingDescription: order.shippingDescription ?? title,
                    shipRecipientName:
                      order.shipRecipientName ?? order.customerName,
                    shipRecipientPhone:
                      order.shipRecipientPhone ?? order.customerPhone,
                  }}
                />
              </Card>

              <EcontPanel
                readiness={econtState ?? { ready: false, problems: [] }}
                estimatedPriceCents={order.estimatedPriceCents}
                priceIsEstimate={order.priceIsEstimate}
                environment={econtEnvironment()}
                trackingBaseUrl="https://www.econt.com/services/track-shipment/"
                shipments={shipments.map((shipment) => ({
                  id: shipment.id,
                  shipmentNumber: shipment.shipmentNumber,
                  pdfUrl: shipment.pdfUrl,
                  totalPriceCents: shipment.totalPriceCents,
                  codAmountCents: shipment.codAmountCents,
                  receiverDueCents: shipment.receiverDueCents,
                  currency: shipment.currency,
                  expectedDeliveryDate:
                    shipment.expectedDeliveryDate?.toISOString() ?? null,
                  environment: shipment.environment,
                  trackingStatus: shipment.trackingStatus,
                  trackingUpdatedAt:
                    shipment.trackingUpdatedAt?.toISOString() ?? null,
                  voidedAt: shipment.voidedAt?.toISOString() ?? null,
                  createdAt: shipment.createdAt.toISOString(),
                }))}
                defaults={{
                  orderId: order.id,
                  receiverName: order.shipRecipientName || order.customerName,
                  receiverPhone:
                    order.shipRecipientPhone || order.customerPhone,
                  receiverEmail: order.customerEmail,
                  deliveryTo:
                    order.fulfillmentMethod === "ECONT_OFFICE"
                      ? "office"
                      : "address",
                  officeCode: order.shipOfficeCode ?? "",
                  officeName: order.shipOfficeName ?? "",
                  cityId: order.shipCityId ? String(order.shipCityId) : "",
                  cityName: order.shipCityName ?? "",
                  postCode: order.shipPostCode ?? "",
                  quarter: order.shipQuarter ?? "",
                  street: order.shipStreet ?? "",
                  streetNum: order.shipStreetNum ?? "",
                  other: order.shipOther ?? "",
                  packCount: String(order.packageCount ?? 1),
                  weightKg: order.shippingWeightKg ?? "1.00",
                  description: order.shippingDescription ?? title,
                }}
              />
            </>
          ) : null}
        </div>

        {/* ----------------------------------------------- Right column */}
        <div className="space-y-4">
          <Card title="Статус">
            <StatusControl
              orderId={order.id}
              currentStatus={order.status}
              customerEmail={order.customerEmail}
            />
          </Card>

          <Card title="История">
            <ol className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 flex-none rounded-full bg-rose-dark"
                  />
                  <div className="min-w-0">
                    <p className="text-[0.88rem] font-semibold">
                      {ORDER_STATUS_LABELS[entry.toStatus]}
                    </p>
                    <p className="text-[0.78rem] text-ink-faint">
                      {formatDateTime(entry.createdAt)} · {entry.actor}
                    </p>
                    {entry.note ? (
                      <p className="mt-1 text-[0.82rem] text-ink-soft">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <NotesPanel orderId={order.id} notes={notes.map((note) => ({
            id: note.id,
            body: note.body,
            authorName: note.authorName,
            createdAt: note.createdAt.toISOString(),
          }))} />

          <Card
            title="Вътрешен QR код"
            description="Отваря обобщение за подготовка на пратката, без лични данни."
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-[var(--radius-sm)] border border-line bg-paper p-2"
                // The SVG is produced locally by the qrcode library from a
                // value we control; nothing user-supplied reaches it.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="break-all text-center text-[0.72rem] text-ink-faint">
                {qrUrl}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <CopyButton value={qrUrl} label="Копирай връзката" />
                <Link
                  href={`/order-summary/${order.qrToken}`}
                  target="_blank"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[3px] border border-line bg-paper px-3 text-[0.8rem] font-semibold transition-colors hover:border-ink"
                >
                  <QrCode size={13} aria-hidden="true" />
                  Отвори
                </Link>
                <ConfirmAction
                  action={regenerateQrToken}
                  hiddenFields={{ orderId: order.id }}
                  variant="secondary"
                  label={
                    <>
                      <RefreshCw size={13} aria-hidden="true" />
                      Обнови кода
                    </>
                  }
                  title="Обновяване на QR кода"
                  message="Ще бъде издаден нов адрес. Разпечатаните до момента кодове ще спрат да работят."
                  confirmLabel="Обнови"
                />
              </div>
              <p className="text-center text-[0.72rem] text-ink-faint">
                Този код е вътрешен и е различен от баркода на товарителницата
                на Еконт.
              </p>
            </div>
          </Card>

          <Card title="Изпратени имейли">
            {emails.length === 0 ? (
              <p className="text-[0.86rem] text-ink-soft">Няма записи.</p>
            ) : (
              <ul className="space-y-2.5">
                {emails.map((email) => (
                  <li
                    key={email.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="text-[0.84rem]">
                      {email.kind === "OWNER_NEW_ORDER"
                        ? "Известие до вас"
                        : email.kind === "CUSTOMER_RECEIVED"
                          ? "Потвърждение до клиента"
                          : "Промяна на статуса"}
                    </span>
                    <Badge
                      tone={
                        email.status === "SENT"
                          ? "positive"
                          : email.status === "SKIPPED"
                            ? "muted"
                            : "danger"
                      }
                    >
                      {email.status === "SENT"
                        ? "Изпратен"
                        : email.status === "SKIPPED"
                          ? "Пропуснат"
                          : "Неуспешен"}
                    </Badge>
                    {email.error ? (
                      <span className="w-full text-[0.76rem] text-ink-faint">
                        {email.error}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
