import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Package, Truck } from "lucide-react";

import { ProductCard } from "@/components/site/cards";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Container, Section } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, ORDERABLE_AVAILABILITY } from "@/lib/labels";
import {
  getPublicProductBySlug,
  listPublicProducts,
} from "@/server/queries/catalog";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string; product: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { product: slug } = await params;
  const [product, settings] = await Promise.all([
    getPublicProductBySlug(slug),
    getSettings(),
  ]);

  if (!product) return { title: "Продуктът не е намерен" };

  const url = `/menu/${product.category.slug}/${product.slug}`;
  const image = product.images[0]?.path;

  return {
    title: product.name,
    description: product.shortDescription || product.description.slice(0, 160),
    alternates: { canonical: url },
    openGraph: {
      title: `${product.name} · ${settings.businessName}`,
      description: product.shortDescription,
      url,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { product: slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) notFound();

  const related = (
    await listPublicProducts({ categoryId: product.categoryId, limit: 4 })
  ).filter((p) => p.id !== product.id);

  const price = formatPrice(product.basePriceCents);
  const orderable = ORDERABLE_AVAILABILITY.includes(product.availability);
  const image = product.images[0];

  return (
    <>
      <Section tone="cream" className="pb-12 pt-10 lg:pt-14">
        <Container>
          <Link
            href={`/menu/${product.category.slug}`}
            className="inline-flex items-center gap-2 text-[0.85rem] font-semibold text-ink-soft transition-colors hover:text-rose-dark"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {product.category.name}
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-[linear-gradient(135deg,#e9cec8,#c98791)]">
              {image ? (
                <Image
                  src={image.path}
                  alt={image.alt || product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center px-10 text-center font-[family-name:var(--font-display)] text-[2rem] leading-tight text-paper/75">
                  {product.name}
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="rose">{product.category.name}</Badge>
                {product.isFeatured ? <Badge tone="gold">Избрано</Badge> : null}
                {product.availability !== "ACTIVE" ? (
                  <Badge
                    tone={
                      product.availability === "UNAVAILABLE" ? "danger" : "sage"
                    }
                  >
                    {AVAILABILITY_LABELS[product.availability]}
                  </Badge>
                ) : null}
              </div>

              <h1 className="display-2 mt-4">{product.name}</h1>

              {product.shortDescription ? (
                <p className="lede mt-4">{product.shortDescription}</p>
              ) : null}

              <dl className="mt-7 grid gap-x-8 gap-y-4 border-y border-line py-6 sm:grid-cols-2">
                <div>
                  <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                    Цена
                  </dt>
                  <dd className="mt-1 font-[family-name:var(--font-display)] text-[1.5rem]">
                    {price ? `от ${price}` : "След уточнение"}
                  </dd>
                </div>
                {product.portions ? (
                  <div>
                    <dt className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                      Порции
                    </dt>
                    <dd className="mt-1 font-[family-name:var(--font-display)] text-[1.5rem]">
                      {product.portions}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {product.description ? (
                <p className="mt-6 whitespace-pre-line text-[0.98rem] leading-relaxed text-ink-soft">
                  {product.description}
                </p>
              ) : null}

              <ul className="mt-6 space-y-2 text-[0.88rem] text-ink-soft">
                <li className="flex items-center gap-2">
                  <Package size={15} aria-hidden="true" className="text-rose-dark" />
                  {product.pickupAllowed
                    ? "Вземане на място"
                    : "Само по договаряне"}
                </li>
                {product.shippingAllowed ? (
                  <li className="flex items-center gap-2">
                    <Truck size={15} aria-hidden="true" className="text-rose-dark" />
                    Възможна доставка с Еконт
                  </li>
                ) : null}
              </ul>

              {product.ingredients || product.allergens.length > 0 ? (
                <div className="panel-sm mt-7 bg-paper p-5">
                  {product.ingredients ? (
                    <>
                      <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                        Състав
                      </p>
                      <p className="mt-1.5 text-[0.9rem] text-ink-soft">
                        {product.ingredients}
                      </p>
                    </>
                  ) : null}
                  {product.allergens.length > 0 ? (
                    <>
                      <p className="mt-4 text-[0.74rem] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                        Алергени
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {product.allergens.map((allergen) => (
                          <li key={allergen}>
                            <Badge tone="warning">{allergen}</Badge>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {product.allergenNote ? (
                    <p className="mt-3 flex items-start gap-2 text-[0.82rem] text-ink-soft">
                      <Info
                        size={14}
                        aria-hidden="true"
                        className="mt-0.5 flex-none"
                      />
                      {product.allergenNote}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                {orderable ? (
                  <>
                    <ButtonLink
                      href={`/order?product=${product.id}`}
                      variant="rose"
                      size="lg"
                    >
                      Поръчай този продукт
                    </ButtonLink>
                    {product.isCustomizable && product.dessertTypeId ? (
                      <ButtonLink
                        href={`/order?mode=custom&dessert=${product.dessertTypeId}`}
                        variant="outline"
                        size="lg"
                      >
                        Персонализирай
                      </ButtonLink>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-[var(--radius-sm)] border border-line bg-surface-sunk px-4 py-3 text-[0.9rem] text-ink-soft">
                    Този продукт временно не се приема за поръчка. Свържете се с
                    нас за повече информация.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {related.length > 0 ? (
        <Section tone="paper">
          <Container>
            <h2 className="display-2 mb-9">Още от {product.category.name}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.slice(0, 3).map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
