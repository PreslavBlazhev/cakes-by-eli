import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ConfirmAction, QuickAction } from "@/components/admin/ActionForm";
import {
  AdminEmpty,
  Card,
  DataTable,
  DemoNotice,
  PageHeader,
  Td,
  Th,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/primitives";
import {
  archiveProduct,
  clearDemoContent,
  restoreProduct,
  toggleProductVisibility,
} from "@/server/admin/catalog";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { listAdminProducts } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Продукти" };

export default async function AdminProductsPage() {
  const products = await listAdminProducts();
  const demoCount = products.filter((product) => product.isDemo).length;

  return (
    <>
      <PageHeader
        title="Продукти"
        description="Това, което клиентите виждат в менюто и могат да поръчат."
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.86rem] font-semibold text-paper transition-colors hover:bg-cocoa"
          >
            <Plus size={15} aria-hidden="true" />
            Добави продукт
          </Link>
        }
      />

      {demoCount > 0 ? (
        <DemoNotice>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {demoCount} от продуктите са примерни (демо съдържание от
              инсталацията). Заменете ги с реални или ги премахнете, преди
              сайтът да излезе онлайн.
            </span>
            <ConfirmAction
              action={clearDemoContent}
              hiddenFields={{}}
              label="Премахни всички демо продукти"
              title="Премахване на демо продукти"
              message="Всички продукти, маркирани като демо съдържание, ще бъдат изтрити заедно със снимките си. Реалните ви продукти остават непокътнати."
              confirmLabel="Премахни"
            />
          </div>
        </DemoNotice>
      ) : null}

      <Card padded={false}>
        {products.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title="Няма продукти."
              description="Добавете първия продукт, за да се появи в менюто."
              action={
                <Link
                  href="/admin/products/new"
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.86rem] font-semibold text-paper"
                >
                  <Plus size={15} aria-hidden="true" />
                  Добави продукт
                </Link>
              }
            />
          </div>
        ) : (
          <DataTable
            head={
              <>
                <Th className="w-[70px]">Снимка</Th>
                <Th>Продукт</Th>
                <Th>Категория</Th>
                <Th>Цена</Th>
                <Th>Статус</Th>
                <Th className="text-right">Действия</Th>
              </>
            }
          >
            {products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-line last:border-0 hover:bg-surface-sunk/60"
              >
                <Td>
                  <span className="relative block size-12 overflow-hidden rounded-[var(--radius-xs)] border border-line bg-surface-sunk">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].path}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-bold text-rose-dark hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    {product.isFeatured ? (
                      <Badge tone="gold">Избран</Badge>
                    ) : null}
                    {product.isCustomizable ? (
                      <Badge tone="rose">Персонализируем</Badge>
                    ) : null}
                    {product.shippingAllowed ? (
                      <Badge tone="sage">Еконт</Badge>
                    ) : null}
                    {product.isDemo ? <Badge tone="warning">Демо</Badge> : null}
                  </span>
                </Td>
                <Td className="text-ink-soft">{product.category.name}</Td>
                <Td>
                  {formatPrice(product.basePriceCents) ?? (
                    <span className="text-ink-faint">След уточнение</span>
                  )}
                </Td>
                <Td>
                  {product.archivedAt ? (
                    <Badge tone="muted">Архивиран</Badge>
                  ) : (
                    <Badge
                      tone={
                        product.availability === "ACTIVE"
                          ? "positive"
                          : product.availability === "UNAVAILABLE"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {AVAILABILITY_LABELS[product.availability]}
                    </Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {product.archivedAt ? (
                      <QuickAction
                        action={restoreProduct}
                        hiddenFields={{ id: product.id }}
                        label="Възстанови"
                      />
                    ) : (
                      <>
                        <QuickAction
                          action={toggleProductVisibility}
                          hiddenFields={{ id: product.id }}
                          label={
                            product.availability === "HIDDEN"
                              ? "Покажи"
                              : "Скрий"
                          }
                        />
                        <ConfirmAction
                          action={archiveProduct}
                          hiddenFields={{ id: product.id }}
                          label="Архивирай"
                          title="Архивиране на продукт"
                          message={`„${product.name}“ ще спре да се показва в сайта. Данните и старите поръчки се запазват и продуктът може да бъде възстановен.`}
                          confirmLabel="Архивирай"
                          variant="secondary"
                        />
                      </>
                    )}
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}
