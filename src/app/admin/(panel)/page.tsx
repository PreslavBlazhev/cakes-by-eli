import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  AdminEmpty,
  Card,
  DataTable,
  PageHeader,
  StatTile,
  StatusBadge,
  Td,
  Th,
} from "@/components/admin/ui";
import { readSnapshot, snapshotTitle } from "@/features/orders/snapshot";
import { formatDate, formatDateTime } from "@/lib/format";
import { ORDER_TYPE_LABELS } from "@/lib/labels";
import {
  getDashboardStats,
  getRecentOrders,
} from "@/server/queries/orders";
import { getUpcomingExceptions } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Табло" };

export default async function AdminDashboard() {
  const [stats, recent, exceptions] = await Promise.all([
    getDashboardStats(),
    getRecentOrders(8),
    getUpcomingExceptions(),
  ]);

  const tiles = [
    {
      label: "Нови",
      value: stats.byStatus.NEW ?? 0,
      href: "/admin/orders?status=NEW",
      tone: "new" as const,
    },
    {
      label: "За преглед",
      value: stats.byStatus.REVIEWING ?? 0,
      href: "/admin/orders?status=REVIEWING",
      tone: "progress" as const,
    },
    {
      label: "Потвърдени",
      value: stats.byStatus.CONFIRMED ?? 0,
      href: "/admin/orders?status=CONFIRMED",
      tone: "positive" as const,
    },
    {
      label: "В изработка",
      value: stats.byStatus.IN_PRODUCTION ?? 0,
      href: "/admin/orders?status=IN_PRODUCTION",
      tone: "progress" as const,
    },
    {
      label: "Готови",
      value: stats.byStatus.READY ?? 0,
      href: "/admin/orders?status=READY",
      tone: "positive" as const,
    },
    {
      label: "Чакат клиента",
      value: stats.byStatus.AWAITING_CUSTOMER ?? 0,
      href: "/admin/orders?status=AWAITING_CUSTOMER",
      tone: "info" as const,
    },
  ];

  const nextException = exceptions[0];

  return (
    <>
      <PageHeader
        title="Табло"
        description="Общ поглед върху поръчките и предстоящата работа."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="За днес"
          value={stats.todayCount}
          hint="Поръчки с дата за изпълнение днес"
          href="/admin/calendar"
        />
        <StatTile
          label="Следващите 7 дни"
          value={stats.next7DaysCount}
          hint="Активни поръчки за изработка"
          href="/admin/calendar"
        />
        <StatTile
          label="Общо поръчки"
          value={stats.totalOrders}
          hint="От създаването на сайта"
          href="/admin/orders"
        />
      </div>

      {nextException ? (
        <div className="mt-5 rounded-[var(--radius-md)] border border-info/25 bg-info-soft px-4 py-3 text-[0.86rem] text-info">
          Следваща обявена промяна в работното време:{" "}
          <strong>{formatDate(nextException.date)}</strong> —{" "}
          {nextException.isClosed ? "затворено" : "съкратено работно време"}
          {nextException.note ? ` (${nextException.note})` : ""}.{" "}
          <Link href="/admin/exceptions" className="underline underline-offset-4">
            Управление
          </Link>
        </div>
      ) : null}

      <Card
        className="mt-6"
        title="Последни поръчки"
        actions={
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-[0.84rem] font-semibold text-rose-dark hover:underline"
          >
            Всички поръчки
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
        padded={false}
      >
        {recent.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title="Няма поръчки."
              description="Когато клиент изпрати запитване през сайта, то ще се появи тук."
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
                <Th>Получена</Th>
                <Th>Статус</Th>
              </>
            }
          >
            {recent.map((order) => {
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
                    <span className="block text-[0.8rem] text-ink-soft">
                      {order.customerPhone}
                    </span>
                  </Td>
                  <Td>{snapshotTitle(snapshot)}</Td>
                  <Td className="text-ink-soft">
                    {ORDER_TYPE_LABELS[order.orderType]}
                  </Td>
                  <Td>{formatDate(order.fulfillmentDate)}</Td>
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
    </>
  );
}
