import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Info, Package, Truck } from "lucide-react";

import { ProductCard } from "@/components/site/cards";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Container, Label, Section } from "@/components/ui/primitives";
import { RichText } from "@/components/ui/RichText";
import { formatAllergen, selectedAllergens } from "@/lib/allergens";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, ORDERABLE_AVAILABILITY } from "@/lib/labels";
import { richTextToPlain } from "@/lib/rich-text";
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
    description:
      product.shortDescription ||
      richTextToPlain(product.description).slice(0, 160),
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
  const [lead, ...secondary] = product.images;
  const allergens = selectedAllergens(product.allergens);

  return (
    <>
      <div className="bg-cream pb-16 pt-8 lg:pb-24 lg:pt-10">
        <Container>
          {/* -------------------------------------------- Breadcrumbs */}
          <nav aria-label="Навигация по нива" className="mb-9">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
              {[
                { href: "/menu", label: "Меню" },
                {
                  href: `/menu/${product.category.slug}`,
                  label: product.category.name,
                },
              ].map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-line-strong">
                      /
                    </span>
                  ) : null}
                  <a
                    href={crumb.href}
                    className="link-underline transition-colors hover:text-rose-dark"
                  >
                    {crumb.label}
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-3">
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
                <span aria-current="page" className="text-ink-soft">
                  {product.name}
                </span>
              </li>
            </ol>
          </nav>

          <div className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            {/* ------------------------------------------ Photography */}
            <div className="lg:sticky lg:top-[112px] lg:self-start">
              <div
                className="frame relative aspect-[4/5] w-full"
                style={
                  lead
                    ? undefined
                    : { background: "linear-gradient(150deg,#e5cdc9,#b57f88)" }
                }
              >
                {lead ? (
                  <Image
                    src={lead.path}
                    alt={lead.alt || product.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 52vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-10 text-center font-[family-name:var(--font-display)] text-[2rem] leading-tight text-paper/75">
                    {product.name}
                  </span>
                )}
              </div>

              {secondary.length > 0 ? (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {secondary.slice(0, 3).map((img) => (
                    <div key={img.path} className="frame relative aspect-square">
                      <Image
                        src={img.path}
                        alt={img.alt || ""}
                        fill
                        sizes="18vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ----------------------------------------------- Details */}
            <div className="lg:pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <Label>{product.category.name}</Label>
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

              <h1 className="display-2 mt-5">{product.name}</h1>

              {product.shortDescription ? (
                <p className="lede mt-5">{product.shortDescription}</p>
              ) : null}

              {/* Spec rail — set like the facts column of a printed
                  product sheet, not as boxed stat cards. */}
              <dl className="mt-9 border-t border-line">
                <SpecRow
                  term="Цена"
                  value={price ?? "След уточнение"}
                  emphasis
                />
                {product.portions ? (
                  <SpecRow term="Порции" value={product.portions} />
                ) : null}
                <SpecRow
                  term="Получаване"
                  value={
                    <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
                      <span className="flex items-center gap-2">
                        <Package
                          size={14}
                          aria-hidden="true"
                          className="text-ink-faint"
                        />
                        {product.pickupAllowed
                          ? "Вземане на място"
                          : "По договаряне"}
                      </span>
                      {product.shippingAllowed ? (
                        <span className="flex items-center gap-2">
                          <Truck
                            size={14}
                            aria-hidden="true"
                            className="text-ink-faint"
                          />
                          Доставка с Еконт
                        </span>
                      ) : null}
                    </span>
                  }
                />
                {product.ingredients ? (
                  <SpecRow term="Състав" value={product.ingredients} />
                ) : null}
                {allergens.length > 0 ? (
                  <div className="border-b border-line py-4">
                    <dt className="text-[0.94rem] font-bold text-ink">
                      Алергени:
                    </dt>
                    <dd className="mt-2 text-[0.94rem] leading-relaxed text-ink-soft">
                      <ul>
                        {allergens.map((allergen) => (
                          <li key={allergen.code}>{formatAllergen(allergen)}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {product.allergenNote ? (
                <p className="mt-5 flex items-start gap-2.5 text-[0.82rem] leading-relaxed text-ink-soft">
                  <Info
                    size={14}
                    aria-hidden="true"
                    className="mt-1 flex-none text-ink-faint"
                  />
                  {product.allergenNote}
                </p>
              ) : null}

              {product.description ? (
                <div className="mt-9">
                  <Label tone="muted" className="mb-4 block">
                    За десерта
                  </Label>
                  <p className="whitespace-pre-line text-[1rem] leading-[1.75] text-ink-soft">
                    <RichText value={product.description} />
                  </p>
                </div>
              ) : null}

              <div className="mt-11 flex flex-wrap gap-3">
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
                  <p className="border-l-2 border-line-strong bg-surface-sunk px-5 py-4 text-[0.9rem] leading-relaxed text-ink-soft">
                    Този продукт временно не се приема за поръчка. Свържете се с
                    нас за повече информация.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Container>
      </div>

      {related.length > 0 ? (
        <Section tone="paper" size="sm">
          <Container>
            <div className="border-t border-line pt-8">
              <Label>Още от категорията</Label>
              <h2 className="display-3 mt-4">{product.category.name}</h2>
            </div>
            <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
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

/* ------------------------------------------------------------------ */

function SpecRow({
  term,
  value,
  emphasis,
}: {
  term: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-4 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
        {term}
      </dt>
      <dd
        className={cn(
          "text-[0.94rem] leading-relaxed text-ink-soft",
          emphasis &&
            "numeral font-[family-name:var(--font-display)] text-[1.5rem] leading-none text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
