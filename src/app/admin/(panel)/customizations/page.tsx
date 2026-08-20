import Link from "next/link";
import { asc } from "drizzle-orm";

import { Card, PageHeader } from "@/components/admin/ui";
import { QuickAction } from "@/components/admin/ActionForm";
import { DessertTypeDialog } from "./DessertTypeDialog";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/db/client";
import { customizationGroups, dessertTypes } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { toggleDessertType } from "@/server/admin/customizations";
import { listAllCategories } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Персонализации" };

export default async function AdminCustomizationsPage() {
  const [types, groups, categories] = await Promise.all([
    db.select().from(dessertTypes).orderBy(asc(dessertTypes.sortOrder)),
    db.select().from(customizationGroups),
    listAllCategories(),
  ]);

  const groupCounts = new Map<string, number>();
  for (const group of groups) {
    groupCounts.set(
      group.dessertTypeId,
      (groupCounts.get(group.dessertTypeId) ?? 0) + 1,
    );
  }

  return (
    <>
      <PageHeader
        title="Персонализации"
        description="Видовете десерти и въпросите, които клиентът вижда в конфигуратора."
        actions={
          <DessertTypeDialog
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        }
      />

      <div className="mb-4 rounded-[var(--radius-sm)] border border-info/25 bg-info-soft px-4 py-3 text-[0.84rem] text-info">
        Всяка промяна тук се отразява веднага в конфигуратора на страница
        „Поръчка“. Цените са незадължителни — ако липсват, клиентът вижда „Цена
        след уточнение“.
      </div>

      <Card padded={false}>
        <ul className="divide-y divide-line">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex flex-wrap items-center gap-3 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/customizations/${type.id}`}
                    className="font-bold text-rose-dark hover:underline"
                  >
                    {type.name}
                  </Link>
                  {type.isActive ? null : <Badge tone="muted">Изключен</Badge>}
                  <Badge tone="neutral">
                    {groupCounts.get(type.id) ?? 0} групи
                  </Badge>
                  <Badge tone="sage">визуализация: {type.renderer}</Badge>
                </div>
                <p className="mt-0.5 text-[0.82rem] text-ink-soft">
                  {type.description || "Без описание"}
                  {" · базова цена: "}
                  {formatPrice(type.basePriceCents) ?? "не е зададена"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/customizations/${type.id}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-line bg-paper px-3.5 text-[0.82rem] font-semibold transition-colors hover:border-ink"
                >
                  Настрой опциите
                </Link>
                <QuickAction
                  action={toggleDessertType}
                  hiddenFields={{ id: type.id }}
                  label={type.isActive ? "Изключи" : "Включи"}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
