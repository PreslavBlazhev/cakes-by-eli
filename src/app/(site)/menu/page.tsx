import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CategoryCard, ProductCard } from "@/components/site/cards";
import { PageHeader } from "@/components/site/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import {
  Container,
  EmptyState,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { listPublicCategories, listPublicProducts } from "@/server/queries/catalog";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "Меню",
    description: `Категории десерти на ${settings.businessName}: торти, еклери, макарони, къпкейкове, декорирани бисквити и още.`,
    alternates: { canonical: "/menu" },
    openGraph: {
      title: `Меню · ${settings.businessName}`,
      description:
        "Разгледайте категориите десерти и поръчайте директно или създайте свой десерт.",
      url: "/menu",
    },
  };
}

export default async function MenuPage() {
  const [categories, featured] = await Promise.all([
    listPublicCategories(),
    listPublicProducts({ featuredOnly: true, limit: 3 }),
  ]);

  const visible = categories.filter((c) => c.productCount > 0 || c.description);
  const total = visible.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <>
      <PageHeader
        label="Менюто"
        title={
          <>
            Изберете вида
            <br />
            <em className="display-italic">десерт.</em>
          </>
        }
        intro="Всяка категория води към конкретните предложения. Ако имате идея, която не намирате тук, отворете конфигуратора и я съставете сами."
        actions={
          <ButtonLink href="/order?mode=custom" variant="rose">
            Създай персонална поръчка
            <ArrowRight size={15} aria-hidden="true" />
          </ButtonLink>
        }
        aside={
          visible.length > 0 ? (
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-ink-faint">
              <span className="numeral me-1 text-ink">{visible.length}</span>{" "}
              категории
              {total > 0 ? (
                <>
                  {" · "}
                  <span className="numeral me-1 text-ink">{total}</span> предложения
                </>
              ) : null}
            </p>
          ) : null
        }
      />

      {/* ------------------------------------------------ Category index */}
      <Section tone="cream" size="sm" className="pt-0">
        <Container>
          {visible.length === 0 ? (
            <EmptyState
              title="Менюто се подготвя"
              description="Категориите ще се появят тук веднага щом бъдат добавени."
              action={
                <ButtonLink href="/contacts" variant="rose">
                  Свържете се с нас
                </ButtonLink>
              }
            />
          ) : (
            <>
              {/* Quick jump rail — a real catalogue lets you skip ahead
                  instead of scrolling past everything. */}
              <nav aria-label="Бърз преглед на категориите" className="mb-14">
                <ul className="flex flex-wrap gap-x-7 gap-y-3 border-y border-line py-4">
                  {visible.map((category, index) => (
                    <li key={category.id}>
                      <Link
                        href={`/menu/${category.slug}`}
                        className="link-underline flex items-baseline gap-2 text-[0.74rem] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-rose-dark"
                      >
                        <span aria-hidden="true" className="numeral text-[0.62rem] text-ink-faint">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
                {visible.map((category, index) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    productCount={category.productCount}
                    index={index}
                  />
                ))}
              </div>
            </>
          )}
        </Container>
      </Section>

      {/* ---------------------------------------------------- Most asked */}
      {featured.length > 0 ? (
        <Section tone="paper">
          <Container>
            <SectionHeading
              eyebrow="Избрани"
              title={
                <>
                  Най-често
                  <br />
                  <em className="display-italic">поръчвани.</em>
                </>
              }
              intro="Предложения, които могат да бъдат адаптирани към вашия повод."
            />
            <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
              {featured.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showCategory
                />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
