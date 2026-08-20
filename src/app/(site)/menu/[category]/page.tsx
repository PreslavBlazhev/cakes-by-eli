import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ProductCard } from "@/components/site/cards";
import { ButtonLink } from "@/components/ui/Button";
import {
  Container,
  EmptyState,
  Eyebrow,
  Section,
} from "@/components/ui/primitives";
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
      <section className="relative overflow-hidden pb-6 pt-10 lg:pt-16">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-44 -z-10 size-[360px] rounded-full bg-blush opacity-55"
        />
        <Container>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 text-[0.85rem] font-semibold text-ink-soft transition-colors hover:text-rose-dark"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Всички категории
          </Link>

          <Eyebrow className="mt-6">Меню</Eyebrow>
          <h1 className="display-1 mt-4">{category.name}</h1>
          {category.description ? (
            <p className="lede mt-5 max-w-[720px] text-[1.06rem]">
              {category.description}
            </p>
          ) : null}
        </Container>
      </section>

      <Section tone="cream" className="pt-10">
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </Section>

      {siblings.length > 0 ? (
        <Section tone="paper" className="py-14">
          <Container>
            <h2 className="display-3">Други категории</h2>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {siblings.map((sibling) => (
                <li key={sibling.id}>
                  <Link
                    href={`/menu/${sibling.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-cream px-5 text-[0.9rem] font-semibold transition-colors hover:border-ink hover:bg-paper"
                  >
                    {sibling.name}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
