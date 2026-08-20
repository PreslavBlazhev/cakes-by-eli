import type { Metadata } from "next";

import { GalleryGrid } from "@/components/site/GalleryGrid";
import { PageHeader } from "@/components/site/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Container, EmptyState, Label, Section } from "@/components/ui/primitives";
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
      <PageHeader
        crumbs={[
          { href: "/", label: "Начало" },
          { href: "/gallery", label: "Галерия" },
        ]}
        label="Портфолио"
        title={
          <>
            Малки детайли.
            <br />
            <em className="display-italic">Големи поводи.</em>
          </>
        }
        intro="Подбрани проекти — торти, десерти и тематични композиции, изработени по конкретен повод."
      />

      <Section tone="cream" size="sm" className="pt-0">
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

      {/* Closing invitation — a single ruled block, not a centred hero. */}
      <Section tone="ink" size="md">
        <Container>
          <div className="grid gap-10 border-t border-[#4a3730] pt-10 lg:grid-cols-[1fr_0.85fr] lg:gap-20">
            <div>
              <Label tone="light">Вашият проект</Label>
              <h2 className="display-2 mt-5 text-paper">
                Харесва ви
                <br />
                <em className="display-italic text-[#e7c9a8]">нещо оттук?</em>
              </h2>
            </div>
            <div className="flex flex-col justify-end gap-8">
              <p className="max-w-[42ch] text-[1.02rem] leading-relaxed text-[#cbbab0]">
                Всеки проект може да бъде адаптиран към вашия повод, вкус и
                цветова гама — или можете да съставите свой от нулата.
              </p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/order?mode=custom" variant="rose" size="lg">
                  Създай своя десерт
                </ButtonLink>
                <ButtonLink
                  href="/contacts"
                  variant="ghost"
                  size="lg"
                  className="border-paper/25 bg-transparent text-paper hover:border-paper hover:bg-paper hover:text-ink"
                >
                  Свържи се с нас
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
