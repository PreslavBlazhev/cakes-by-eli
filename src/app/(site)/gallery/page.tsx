import type { Metadata } from "next";

import { GalleryGrid } from "@/components/site/GalleryGrid";
import { ButtonLink } from "@/components/ui/Button";
import {
  Container,
  EmptyState,
  Eyebrow,
  Section,
} from "@/components/ui/primitives";
import { listGallery } from "@/server/queries/gallery";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "Галерия",
    description: `Избрани проекти на ${settings.businessName} — торти, десерти и тематични композиции.`,
    alternates: { canonical: "/gallery" },
    openGraph: {
      title: `Галерия · ${settings.businessName}`,
      description: "Подбрани торти, десерти и тематични композиции.",
      url: "/gallery",
    },
  };
}

export default async function GalleryPage() {
  const items = await listGallery();

  return (
    <>
      <section className="relative overflow-hidden pb-6 pt-14 lg:pt-20">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-44 -z-10 size-[360px] rounded-full bg-blush opacity-55"
        />
        <Container>
          <Eyebrow>Галерия</Eyebrow>
          <h1 className="display-1 mt-4">
            Малки детайли.
            <br />
            Големи поводи.
          </h1>
          <p className="lede mt-5 max-w-[720px] text-[1.06rem]">
            Подбрани проекти — торти, десерти и тематични композиции.
          </p>
        </Container>
      </section>

      <Section tone="cream" className="pt-10">
        <Container>
          {items.length === 0 ? (
            <EmptyState
              title="Все още няма добавени снимки."
              description="Галерията ще се напълни веднага щом бъдат качени първите снимки."
              action={
                <ButtonLink href="/menu" variant="rose">
                  Виж менюто
                </ButtonLink>
              }
            />
          ) : (
            <GalleryGrid
              items={items.map((item) => ({
                id: item.id,
                path: item.path,
                caption: item.caption,
                categoryName: item.categoryName,
                categorySlug: item.categorySlug,
                width: item.width,
                height: item.height,
              }))}
            />
          )}
        </Container>
      </Section>

      <Section tone="paper" className="py-16">
        <Container className="text-center">
          <h2 className="display-2">Харесва ви нещо?</h2>
          <p className="lede mx-auto mt-4">
            Всеки проект може да бъде адаптиран към вашия повод, вкус и цветова
            гама.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/order?mode=custom" variant="rose" size="lg">
              Създай своя десерт
            </ButtonLink>
            <ButtonLink href="/contacts" variant="outline" size="lg">
              Свържи се с нас
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
