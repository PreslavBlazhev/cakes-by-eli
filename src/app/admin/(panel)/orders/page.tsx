import Link from "next/link";
import { Paperclip, Truck } from "lucide-react";

import {
  AdminEmpty,
  Card,
  DataTable,
  PageHeader,
  StatusBadge,
  Td,
  Th,
} from "@/components/admin/ui";
import { OrderFilters } from "./OrderFilters";
import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  FULFILLMENT_SHORT,
  ORDER_STATUS_ORDER,
  ORDER_TYPE_LABELS,
} from "@/lib/labels";
import type { FulfillmentMethod, OrderStatus } from "@/lib/labels";
import { listOrders } from "@/server/queries/orders";

export const dynamic = "force-dynamic";

export const metadata = { title: "Поръчки" };

type SearchParams = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminOrdersPage({ searchParams }: SearchParams) {
  const params = await searchParams;

  const statusParam = first(params.status);
  const status =
    statusParam && ORDER_STATUS_ORDER.includes(statusParam as OrderStatus)
      ? [statusParam as OrderStatus]
      : undefined;

  const typeParam = first(params.type);
  const orderType =
    typeParam === "CATALOG" || typeParam === "CUSTOM" ? typeParam : undefined;

  const methodParam = first(params.method);
  const fulfillmentMethod = (
    ["PICKUP", "ECONT_OFFICE", "ECONT_ADDRESS"] as const
  ).includes(methodParam as FulfillmentMethod)
    ? (methodParam as FulfillmentMethod)
    : undefined;

  const sortParam = first(params.sort);
  const sort =
    sortParam === "created_asc" || sortParam === "fulfillment_asc"
      ? sortParam
      : "created_desc";

  const page = Number(first(params.page) ?? 1) || 1;

  const result = await listOrders({
    status,
    orderType,
    fulfillmentMethod,
    search: first(params.q),
    from: first(params.from),
    to: first(params.to),
    upcomingOnly: first(params.upcoming) === "1",
    sort,
    page,
  });

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const single = first(value);
      if (single) next.set(key, single);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader
        title="Поръчки"
        description={`${result.total} ${result.total === 1 ? "поръчка" : "поръчки"} общо.`}
      />

      <OrderFilters />

      <Card className="mt-4" padded={false}>
        {result.rows.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title="Няма поръчки."
              description="Няма резултати за избраните филтри."
            />
          </div>
        ) : (
          <DataTable
            head={
              <>
                <Th>Номер</Th>
                <Th>Клиент</Th>
                <Th>Десерт</Th>
                <Th>Тип</Th>
                <Th>Желана дата</Th>
                <Th>Получаване</Th>
                <Th>Получена</Th>
                <Th>Статус</Th>
              </>
            }
          >
            {result.rows.map((order) => {
              const snapshot = readSnapshot(order.snapshot);
              return (
                <tr
                  key={order.id}
                  className="border-b border-line last:border-0 hover:bg-surface-sunk/60"
                >
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-bold text-rose-dark hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td>
                    <span className="block font-semibold">
                      {order.customerName}
                    </span>
                    <a
                      href={`tel:${order.customerPhoneE164}`}
                      className="block text-[0.8rem] text-ink-soft hover:text-rose-dark"
                    >
                      {order.customerPhone}
                    </a>
                  </Td>
                  <Td>
                    <span className="block">{snapshotTitle(snapshot)}</span>
                    {order.quantity > 1 ? (
                      <span className="text-[0.78rem] text-ink-faint">
                        × {order.quantity}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-soft">
                    {ORDER_TYPE_LABELS[order.orderType]}
                  </Td>
                  <Td>{formatDate(order.fulfillmentDate)}</Td>
                  <Td className="text-ink-soft">
                    <span className="inline-flex items-center gap-1.5">
                      {order.fulfillmentMethod !== "PICKUP" ? (
                        <Truck size={13} aria-hidden="true" />
                      ) : null}
                      {FULFILLMENT_SHORT[order.fulfillmentMethod]}
                    </span>
                  </Td>
                  <Td className="text-ink-soft">
                    {formatDateTime(order.createdAt)}
                  </Td>
                  <Td>
                    <StatusBadge status={order.status} />
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {result.pageCount > 1 ? (
        <nav
          aria-label="Страници"
          className="mt-4 flex flex-wrap items-center justify-center gap-2"
        >
          {Array.from({ length: result.pageCount }).map((_, index) => {
            const pageNumber = index + 1;
            const active = pageNumber === result.page;
            return (
              <Link
                key={pageNumber}
                href={buildHref({ page: String(pageNumber) })}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex size-10 items-center justify-center rounded-full bg-ink text-[0.85rem] font-bold text-paper"
                    : "flex size-10 items-center justify-center rounded-full border border-line bg-paper text-[0.85rem] font-semibold transition-colors hover:border-ink"
                }
              >
                {pageNumber}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <p className="mt-6 flex items-center gap-1.5 text-[0.8rem] text-ink-faint">
        <Paperclip size={13} aria-hidden="true" />
        Отворете поръчка, за да видите пълната конфигурация, прикачените снимки и
        да създадете товарителница.
      </p>
    </>
  );
}
