import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db/client";
import {
  econtShipments,
  orderAttachments,
  orderEmails,
  orderNotes,
  orders,
  orderStatusHistory,
} from "@/db/schema";
import { addDaysToIsoDate, todayInSofia } from "@/lib/format";
import type { FulfillmentMethod, OrderStatus } from "@/lib/labels";

export type OrderRow = typeof orders.$inferSelect;

export type OrderListFilters = {
  status?: OrderStatus[];
  orderType?: "CATALOG" | "CUSTOM";
  fulfillmentMethod?: FulfillmentMethod;
  search?: string;
  from?: string;
  to?: string;
  upcomingOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "created_desc" | "created_asc" | "fulfillment_asc";
};

export async function listOrders(filters: OrderListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const conditions = [];

  if (filters.status?.length) {
    conditions.push(inArray(orders.status, filters.status));
  }
  if (filters.orderType) {
    conditions.push(eq(orders.orderType, filters.orderType));
  }
  if (filters.fulfillmentMethod) {
    conditions.push(eq(orders.fulfillmentMethod, filters.fulfillmentMethod));
  }
  if (filters.from) {
    conditions.push(gte(orders.fulfillmentDate, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(orders.fulfillmentDate, filters.to));
  }
  if (filters.upcomingOnly) {
    conditions.push(gte(orders.fulfillmentDate, todayInSofia()));
  }

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(orders.orderNumber, pattern),
        ilike(orders.customerName, pattern),
        ilike(orders.customerPhone, pattern),
        ilike(orders.customerEmail, pattern),
        ilike(orders.occasion, pattern),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    filters.sort === "created_asc"
      ? [asc(orders.createdAt)]
      : filters.sort === "fulfillment_asc"
        ? [asc(orders.fulfillmentDate), desc(orders.createdAt)]
        : [desc(orders.createdAt)];

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(orders).where(where),
  ]);

  const total = totals[0]?.total ?? 0;

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) return null;

  const [attachments, history, notes, emails, shipments] = await Promise.all([
    db
      .select()
      .from(orderAttachments)
      .where(eq(orderAttachments.orderId, id))
      .orderBy(asc(orderAttachments.createdAt)),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, id))
      .orderBy(asc(orderStatusHistory.createdAt)),
    db
      .select()
      .from(orderNotes)
      .where(eq(orderNotes.orderId, id))
      .orderBy(desc(orderNotes.createdAt)),
    db
      .select()
      .from(orderEmails)
      .where(eq(orderEmails.orderId, id))
      .orderBy(desc(orderEmails.createdAt)),
    db
      .select()
      .from(econtShipments)
      .where(eq(econtShipments.orderId, id))
      .orderBy(desc(econtShipments.createdAt)),
  ]);

  return { order, attachments, history, notes, emails, shipments };
}

export async function getOrderByQrToken(token: string) {
  if (token.length < 20 || token.length > 64) return null;

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.qrToken, token))
    .limit(1);

  return rows[0] ?? null;
}

export type DashboardStats = {
  byStatus: Record<string, number>;
  todayCount: number;
  next7DaysCount: number;
  totalOrders: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayInSofia();
  const in7 = addDaysToIsoDate(today, 7);

  const [statusRows, todayRows, weekRows, totalRows] = await Promise.all([
    db
      .select({ status: orders.status, total: count() })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({ total: count() })
      .from(orders)
      .where(eq(orders.fulfillmentDate, today)),
    db
      .select({ total: count() })
      .from(orders)
      .where(
        and(
          gte(orders.fulfillmentDate, today),
          lte(orders.fulfillmentDate, in7),
          sql`${orders.status} not in ('CANCELLED', 'COMPLETED')`,
        ),
      ),
    db.select({ total: count() }).from(orders),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) byStatus[row.status] = row.total;

  return {
    byStatus,
    todayCount: todayRows[0]?.total ?? 0,
    next7DaysCount: weekRows[0]?.total ?? 0,
    totalOrders: totalRows[0]?.total ?? 0,
  };
}

export async function getRecentOrders(limit = 8) {
  return db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

/** Confirmed work grouped by fulfilment date, for the production calendar. */
export async function getCalendarOrders(from: string, to: string) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        gte(orders.fulfillmentDate, from),
        lte(orders.fulfillmentDate, to),
        sql`${orders.status} <> 'CANCELLED'`,
      ),
    )
    .orderBy(asc(orders.fulfillmentDate), asc(orders.createdAt));
}
