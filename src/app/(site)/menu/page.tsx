import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { CategoryCard, ProductCard } from "@/components/site/cards";
import { ButtonLink } from "@/components/ui/Button";
import {
  Container,
  EmptyState,
  Eyebrow,
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

  return (
    <>
      <section className="relative overflow-hidden pb-8 pt-14 lg:pt-20">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-44 -z-10 size-[360px] rounded-full bg-blush opacity-55"
        />
        <Container>
          <Eyebrow>Меню</Eyebrow>
          <h1 className="display-1 mt-4">
            Изберете вида
            <br />
            десерт.
          </h1>
          <p className="lede mt-5 max-w-[720px] text-[1.06rem]">
            Всяка категория води към конкретните предложения. Ако имате идея,
            която не намирате тук, отворете конфигуратора и я съставете сами.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/order?mode=custom" variant="rose">
              Създай персонална поръчка
              <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Section tone="cream" className="pt-14">
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  productCount={category.productCount}
                  index={index}
                />
              ))}
            </div>
          )}
        </Container>
      </Section>

      {featured.length > 0 ? (
        <Section tone="paper">
          <Container>
            <SectionHeading
              eyebrow="Избрани"
              title="Най-често поръчвани."
              intro="Предложения, които могат да бъдат адаптирани към вашия повод."
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} showCategory />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
