import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowUp, Package } from "lucide-react";

import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { formatDate } from "@/lib/format";
import { FULFILLMENT_SHORT } from "@/lib/labels";
import { getOrderByQrToken } from "@/server/queries/orders";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Обобщение на пратка",
  robots: { index: false, follow: false, nocache: true },
};

type Params = { params: Promise<{ token: string }> };

/**
 * The page behind the internal QR code.
 *
 * Reached only by an unguessable token and deliberately operational: what is
 * in the box, how heavy it is, how to handle it. No customer e-mail, no
 * address, no internal notes — anyone who finds a printed label can open this.
 */
export default async function OrderSummaryPage({ params }: Params) {
  const { token } = await params;
  const order = await getOrderByQrToken(token);

  if (!order) notFound();

  const [settings] = await Promise.all([getSettings()]);
  const snapshot = readSnapshot(order.snapshot);
  const title = snapshotTitle(snapshot);

  const dimensions =
    order.shippingLengthCm && order.shippingWidthCm && order.shippingHeightCm
      ? `${order.shippingLengthCm} × ${order.shippingWidthCm} × ${order.shippingHeightCm} см`
      : "не са въведени";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-[460px] rounded-[var(--radius-lg)] border border-line bg-paper p-7 shadow-[var(--shadow-soft)]">
        <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-ink-faint">
          {settings.businessName}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[2rem] leading-none tabular-nums">
          {order.orderNumber}
        </h1>

        <dl className="mt-6 divide-y divide-line">
          <Row label="Съдържание" value={title} />
          <Row
            label="Вид"
            value={snapshot?.kind === "CUSTOM" ? "Персонален десерт" : "Продукт от менюто"}
          />
          <Row label="Количество" value={String(order.quantity)} />
          <Row
            label="Тегло"
            value={
              order.shippingWeightKg ? `${order.shippingWeightKg} кг` : "не е въведено"
            }
          />
          <Row label="Размери" value={dimensions} />
          <Row label="Брой пакети" value={String(order.packageCount)} />
          <Row
            label="Начин на получаване"
            value={FULFILLMENT_SHORT[order.fulfillmentMethod]}
          />
          <Row label="Дата за изпълнение" value={formatDate(order.fulfillmentDate)} />
        </dl>

        <div className="mt-6 space-y-2 rounded-[var(--radius-sm)] bg-blush-soft px-4 py-3.5 text-[0.88rem] text-rose-deep">
          <p className="flex items-center gap-2 font-bold">
            <ArrowUp size={15} aria-hidden="true" />
            Дръжте изправено
          </p>
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle size={15} aria-hidden="true" />
            Чупливо — сладкарско изделие
          </p>
          <p className="flex items-center gap-2">
            <Package size={15} aria-hidden="true" />
            Съхранявайте на хладно място
          </p>
        </div>

        <p className="mt-5 text-[0.74rem] leading-relaxed text-ink-faint">
          Това е вътрешна страница за подготовка на пратката. Не съдържа лични
          данни на клиента и е различна от баркода на товарителницата на Еконт.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0">
      <dt className="text-[0.82rem] text-ink-faint">{label}</dt>
      <dd className="text-right text-[0.95rem] font-semibold">{value}</dd>
    </div>
  );
}
