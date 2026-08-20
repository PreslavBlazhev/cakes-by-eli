import type { Metadata } from "next";

import { PageHeader } from "@/components/site/PageHeader";
import { OrderFlow } from "@/features/order/OrderFlow";
import type { OrderFlowData, OrderProductOption } from "@/features/order/types";
import type { DessertTypeConfig } from "@/features/configurator/types";
import { econtIsConfigured } from "@/lib/econt/client";
import { env } from "@/lib/env";
import { todayInSofia } from "@/lib/format";
import { ORDERABLE_AVAILABILITY } from "@/lib/labels";
import { getDessertConfigById } from "@/server/queries/configurator";
import { listConfigurableDesserts } from "@/server/queries/configurator";
import {
  listPublicCategories,
  listPublicProducts,
} from "@/server/queries/catalog";
import { getSettings, getUpcomingExceptions } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "Поръчка",
    description:
      "Поръчайте готов десерт или създайте свой с живия конфигуратор на " +
      settings.businessName,
    alternates: { canonical: "/order" },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Поръчка · ${settings.businessName}`,
      description:
        "Изберете вид, вкус, размер, цветове и декорация и вижте как вашият десерт се променя в реално време.",
      url: "/order",
    },
  };
}

type SearchParams = {
  searchParams: Promise<{
    product?: string;
    mode?: string;
    dessert?: string;
  }>;
};

export default async function OrderPage({ searchParams }: SearchParams) {
  const params = await searchParams;

  const [settings, products, categories, dessertList, exceptions] =
    await Promise.all([
      getSettings(),
      listPublicProducts(),
      listPublicCategories(),
      listConfigurableDesserts(),
      getUpcomingExceptions(),
    ]);

  // Full configurations are shipped up front so switching dessert type is
  // instant; the payload is a few kilobytes of JSON.
  const desserts = (
    await Promise.all(dessertList.map((d) => getDessertConfigById(d.id)))
  ).filter((d): d is DessertTypeConfig => d !== null);

  const orderable: OrderProductOption[] = products
    .filter((product) => ORDERABLE_AVAILABILITY.includes(product.availability))
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      categorySlug: product.category.slug,
      categoryAccent: product.category.accent,
      imagePath: product.images[0]?.path ?? null,
      portions: product.portions,
      basePriceCents: product.basePriceCents,
      availability: product.availability as "ACTIVE" | "SEASONAL",
      isCustomizable: product.isCustomizable,
      dessertTypeId: product.dessertTypeId,
      shippingAllowed: product.shippingAllowed,
      pickupAllowed: product.pickupAllowed,
    }));

  // Query parameters are hints for the UI only — the server action re-resolves
  // and re-authorises every id before an order is written.
  const requestedProduct = params.product
    ? (orderable.find((p) => p.id === params.product)?.id ?? null)
    : null;

  const requestedDessert = params.dessert
    ? (desserts.find((d) => d.id === params.dessert)?.id ?? null)
    : null;

  const mode: "catalog" | "custom" | null =
    params.mode === "custom" || requestedDessert
      ? "custom"
      : requestedProduct
        ? "catalog"
        : null;

  const data: OrderFlowData = {
    products: orderable,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
    })),
    desserts,
    blockedDates: exceptions
      .filter((e) => e.blocksOrders)
      .map((e) => ({
        date: e.date,
        reason:
          e.note || "За тази дата не се приемат поръчки. Моля, изберете друга.",
      })),
    minDate: todayInSofia(),
    disclaimer:
      settings.orderDisclaimer ||
      `Поръчката се счита за потвърдена след потвърждение от ${settings.businessName}.`,
    phone: settings.phone,
    businessName: settings.businessName,
    econtEnabled: econtIsConfigured(),
    maxFiles: env.UPLOAD_MAX_FILES,
    maxFileMb: env.UPLOAD_MAX_FILE_MB,
    initial: {
      mode,
      productId: requestedProduct,
      dessertTypeId: requestedDessert,
    },
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Начало" },
          { href: "/order", label: "Поръчка" },
        ]}
        label="Поръчка"
        title={
          <>
            Разкажете какво
            <br />
            <em className="display-italic">си представяте.</em>
          </>
        }
        intro="Изберете готов продукт от менюто или създайте свой десерт стъпка по стъпка — с жива визуализация на всеки избор."
      />

      <div className="pb-24">
        <OrderFlow data={data} />
      </div>
    </>
  );
}
