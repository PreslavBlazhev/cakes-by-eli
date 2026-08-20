import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/site/cards";
import { PageHeader } from "@/components/site/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Container, EmptyState, Section } from "@/components/ui/primitives";
import {
  getCategoryBySlug,
  listPublicCategories,
  listPublicProducts,
} from "@/server/queries/catalog";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category: slug } = await params;
  const [category, settings] = await Promise.all([
    getCategoryBySlug(slug),
    getSettings(),
  ]);

  if (!category) return { title: "Категорията не е намерена" };

  return {
    title: category.name,
    description:
      category.description ||
      `${category.name} от ${settings.businessName} — по поръчка, в ${settings.city}.`,
    alternates: { canonical: `/menu/${category.slug}` },
    openGraph: {
      title: `${category.name} · ${settings.businessName}`,
      description: category.description,
      url: `/menu/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category || !category.isVisible) notFound();

  const [products, allCategories] = await Promise.all([
    listPublicProducts({ categoryId: category.id }),
    listPublicCategories(),
  ]);

  const siblings = allCategories.filter((c) => c.id !== category.id);

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Начало" },
          { href: "/menu", label: "Меню" },
          { href: `/menu/${category.slug}`, label: category.name },
        ]}
        label="Категория"
        title={category.name}
        intro={category.description || undefined}
        aside={
          products.length > 0 ? (
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-ink-faint">
              <span className="numeral me-1 text-ink">{products.length}</span>{" "}
              {products.length === 1 ? "предложение" : "предложения"}
            </p>
          ) : null
        }
      />

      {/* Category photograph as a full-bleed band — the page's one big
          image, so the products underneath can stay quiet. */}
      {category.imagePath ? (
        <div className="bg-cream pb-4">
          <Container>
            <div className="frame relative aspect-[21/9] w-full max-lg:aspect-[3/2]">
              <Image
                src={category.imagePath}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          </Container>
        </div>
      ) : null}

      <Section tone="cream" size="sm">
        <Container>
          {products.length === 0 ? (
            <EmptyState
              title="Все още няма добавени предложения"
              description="Можете да опишете идеята си директно през формата за поръчка — тя се изработва по ваша заявка."
              action={
                <ButtonLink href="/order?mode=custom" variant="rose">
                  Създай персонална поръчка
                </ButtonLink>
              }
            />
          ) : (
            <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </Section>

      {/* ------------------------------------------------ Sibling index */}
      {siblings.length > 0 ? (
        <Section tone="paper" size="sm">
          <Container>
            <div className="grid gap-8 border-t border-line pt-8 lg:grid-cols-[0.32fr_0.68fr] lg:gap-16">
              <h2 className="display-3">
                Другите
                <br />
                категории
              </h2>
              <ul className="grid gap-x-10 sm:grid-cols-2">
                {siblings.map((sibling, index) => (
                  <li key={sibling.id} className="border-b border-line">
                    <Link
                      href={`/menu/${sibling.slug}`}
                      className="group flex items-baseline gap-4 py-4"
                    >
                      <span
                        aria-hidden="true"
                        className="numeral w-6 flex-none text-[0.68rem] text-ink-faint"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="display-4 flex-1 transition-colors group-hover:text-rose-dark">
                        {sibling.name}
                      </span>
                      {sibling.productCount > 0 ? (
                        <span className="numeral flex-none text-[0.72rem] text-ink-faint">
                          {sibling.productCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
