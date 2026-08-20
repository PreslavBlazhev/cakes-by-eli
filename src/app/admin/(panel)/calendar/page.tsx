import Link from "next/link";
import { Truck } from "lucide-react";

import { AdminEmpty, Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { addDaysToIsoDate, formatLongDate, todayInSofia } from "@/lib/format";
import { FULFILLMENT_SHORT } from "@/lib/labels";
import { getCalendarOrders } from "@/server/queries/orders";
import { getUpcomingExceptions } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Календар" };

type SearchParams = {
  searchParams: Promise<{ days?: string }>;
};

/**
 * Production calendar: what has to be made, grouped by the day it is due.
 * This is the view the kitchen actually plans from.
 */
export default async function AdminCalendarPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const days = Math.min(90, Math.max(7, Number(params.days ?? 30) || 30));

  const today = todayInSofia();
  const until = addDaysToIsoDate(today, days);

  const [orders, exceptions] = await Promise.all([
    getCalendarOrders(today, until),
    getUpcomingExceptions(),
  ]);

  const byDate = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!order.fulfillmentDate) continue;
    const bucket = byDate.get(order.fulfillmentDate);
    if (bucket) bucket.push(order);
    else byDate.set(order.fulfillmentDate, [order]);
  }

  const dates = [...byDate.keys()].sort();
  const exceptionByDate = new Map(exceptions.map((item) => [item.date, item]));

  return (
    <>
      <PageHeader
        title="Календар"
        description={`Предстоящи поръчки за следващите ${days} дни.`}
        actions={
          <div className="flex gap-1.5">
            {[7, 30, 90].map((option) => (
              <Link
                key={option}
                href={`/admin/calendar?days=${option}`}
                className={
                  option === days
                    ? "inline-flex min-h-10 items-center rounded-[3px] bg-ink px-4 text-[0.84rem] font-semibold text-paper"
                    : "inline-flex min-h-10 items-center rounded-[3px] border border-line bg-paper px-4 text-[0.84rem] font-semibold transition-colors hover:border-ink"
                }
              >
                {option} дни
              </Link>
            ))}
          </div>
        }
      />

      {dates.length === 0 ? (
        <AdminEmpty
          title="Няма планирани поръчки."
          description="Поръчките с посочена дата за изпълнение ще се появят тук."
        />
      ) : (
        <div className="space-y-4">
          {dates.map((date) => {
            const dayOrders = byDate.get(date) ?? [];
            const exception = exceptionByDate.get(date);

            return (
              <Card
                key={date}
                title={formatLongDate(date)}
                description={
                  exception
                    ? exception.isClosed
                      ? `Обявено като затворено${exception.note ? ` — ${exception.note}` : ""}`
                      : `Съкратено работно време${exception.note ? ` — ${exception.note}` : ""}`
                    : `${dayOrders.length} ${dayOrders.length === 1 ? "поръчка" : "поръчки"}`
                }
                padded={false}
              >
                <ul className="divide-y divide-line">
                  {dayOrders.map((order) => {
                    const snapshot = readSnapshot(order.snapshot);
                    return (
                      <li
                        key={order.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                      >
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-bold text-rose-dark hover:underline"
                        >
                          {order.orderNumber}
                        </Link>

                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            {snapshotTitle(snapshot)}
                            {order.quantity > 1 ? ` × ${order.quantity}` : ""}
                          </span>
                          <span className="block text-[0.8rem] text-ink-soft">
                            {order.customerName} · {order.customerPhone}
                          </span>
                        </span>

                        <Badge tone="neutral">
                          <span className="inline-flex items-center gap-1">
                            {order.fulfillmentMethod !== "PICKUP" ? (
                              <Truck size={11} aria-hidden="true" />
                            ) : null}
                            {FULFILLMENT_SHORT[order.fulfillmentMethod]}
                          </span>
                        </Badge>

                        <StatusBadge status={order.status} />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
