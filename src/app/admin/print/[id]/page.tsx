import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { PrintTrigger } from "./PrintTrigger";
import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { env } from "@/lib/env";
import { formatDate, formatDateTime, formatPriceOrPending } from "@/lib/format";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from "@/lib/labels";
import { currentAdmin } from "@/server/auth/session";
import { getOrder } from "@/server/queries/orders";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  // Authenticated before the read, not after. Next runs `generateMetadata` and
  // the page in parallel, so without this check an anonymous request to
  // /admin/print/<any-uuid> still executed the six order queries before the
  // page's own guard turned the response into a redirect.
  const admin = await currentAdmin();
  if (!admin) return { title: "Поръчка", robots: { index: false, follow: false } };

  const { id } = await params;
  const data = await getOrder(id);
  return {
    title: data ? `Поръчка ${data.order.orderNumber}` : "Поръчка",
    robots: { index: false, follow: false },
  };
}

/**
 * Printer-friendly production sheet.
 *
 * Optimised for the kitchen, not for the browser: large type, no navigation,
 * everything on one page where possible.
 */
export default async function PrintOrderPage({ params }: Params) {
  // This route lives outside the (panel) group so it renders without the
  // admin chrome, which means it must guard itself.
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();

  const settings = await getSettings();
  const { order, attachments, notes } = data;
  const snapshot = readSnapshot(order.snapshot);
  const title = snapshotTitle(snapshot);

  const qrSvg = await QRCode.toString(
    `${env.APP_URL}/order-summary/${order.qrToken}`,
    { type: "svg", margin: 1, width: 120, color: { dark: "#000", light: "#fff" } },
  );

  return (
    <main className="mx-auto max-w-[820px] bg-white p-8 text-[#111] print:p-0">
      <PrintTrigger />

      <header className="flex items-start justify-between gap-6 border-b-2 border-[#111] pb-4">
        <div>
          <p className="text-[0.75rem] uppercase tracking-[0.18em]">
            {settings.businessName}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-[2.2rem] leading-none">
            {order.orderNumber}
          </h1>
          <p className="mt-2 text-[0.9rem]">
            {ORDER_TYPE_LABELS[order.orderType]} ·{" "}
            {ORDER_STATUS_LABELS[order.status]} · получена{" "}
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div
          className="shrink-0"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
            Клиент
          </h2>
          <p className="mt-2 text-[1.05rem] font-bold">{order.customerName}</p>
          <p className="text-[0.95rem]">{order.customerPhone}</p>
          <p className="text-[0.95rem]">{order.customerEmail}</p>
        </div>

        <div>
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
            Изпълнение
          </h2>
          <p className="mt-2 text-[1.4rem] font-bold">
            {formatDate(order.fulfillmentDate)}
          </p>
          <p className="text-[0.95rem]">
            {FULFILLMENT_LABELS[order.fulfillmentMethod]}
          </p>
          {order.occasion ? (
            <p className="text-[0.95rem]">Повод: {order.occasion}</p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 border-t border-[#999] pt-4">
        <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
          За изработка
        </h2>
        <p className="mt-2 text-[1.5rem] font-bold">{title}</p>
        {order.quantity > 1 ? (
          <p className="text-[1.05rem]">Количество: {order.quantity}</p>
        ) : null}

        {snapshot?.lines.length ? (
          <table className="mt-4 w-full border-collapse text-[1rem]">
            <tbody>
              {snapshot.lines.map((line) => (
                <tr key={line.groupKey} className="border-b border-[#ddd]">
                  <th
                    scope="row"
                    className="w-[190px] py-2 pr-4 text-left align-top font-normal text-[#555]"
                  >
                    {line.group}
                  </th>
                  <td className="py-2 font-bold">{line.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <p className="mt-4 text-[0.95rem]">
          Ориентировъчна цена: {formatPriceOrPending(order.estimatedPriceCents)}
        </p>
      </section>

      {order.notes ? (
        <section className="mt-6 border-t border-[#999] pt-4">
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
            Бележка от клиента
          </h2>
          <p className="mt-2 whitespace-pre-line text-[1rem]">{order.notes}</p>
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section className="mt-6 border-t border-[#999] pt-4">
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
            Вътрешни бележки
          </h2>
          <ul className="mt-2 space-y-1.5 text-[0.95rem]">
            {notes.map((note) => (
              <li key={note.id}>• {note.body}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.fulfillmentMethod !== "PICKUP" ? (
        <section className="mt-6 border-t border-[#999] pt-4">
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
            Доставка
          </h2>
          <p className="mt-2 text-[1rem]">
            {order.shipRecipientName || order.customerName} ·{" "}
            {order.shipRecipientPhone || order.customerPhone}
          </p>
          <p className="text-[1rem]">
            {order.fulfillmentMethod === "ECONT_OFFICE"
              ? order.shipOfficeName || order.shipOfficeCode
              : [
                  order.shipCityName,
                  order.shipQuarter,
                  order.shipStreet,
                  order.shipStreetNum,
                  order.shipOther,
                ]
                  .filter(Boolean)
                  .join(", ")}
          </p>
          <p className="mt-2 text-[0.95rem]">
            {order.shippingWeightKg ?? "—"} кг ·{" "}
            {order.shippingLengthCm ?? "—"} × {order.shippingWidthCm ?? "—"} ×{" "}
            {order.shippingHeightCm ?? "—"} см · {order.packageCount} пакет(а)
          </p>
        </section>
      ) : null}

      {attachments.length > 0 ? (
        <section className="mt-6 break-inside-avoid border-t border-[#999] pt-4">
          <h2 className="text-[0.72rem] font-bold uppercase tracking-[0.16em]">
            Референтни снимки
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {attachments.slice(0, 4).map((attachment) => (
              <span
                key={attachment.id}
                className="relative block h-[130px] w-[170px] overflow-hidden border border-[#ccc]"
              >
                <Image
                  src={attachment.path}
                  alt={attachment.originalName}
                  fill
                  sizes="170px"
                  className="object-cover"
                />
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-[#999] pt-3 text-[0.78rem] text-[#666]">
        {settings.businessName}
        {settings.phone ? ` · ${settings.phone}` : ""}
        {settings.addressLine ? ` · ${settings.addressLine}, ${settings.city}` : ""}
      </footer>
    </main>
  );
}
