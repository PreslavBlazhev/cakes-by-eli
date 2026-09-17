import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { CategoryCard, ProductCard } from "@/components/site/cards";
import { Marquee } from "@/components/site/Marquee";
import { SocialLinks } from "@/components/site/SocialLinks";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/Button";
import {
  Container,
  Label,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { listPublicCategories, listPublicProducts } from "@/server/queries/catalog";
import { listGallery } from "@/server/queries/gallery";
import {
  getSettings,
  getUpcomingExceptions,
  getWorkingHours,
} from "@/server/queries/settings";
import { cn } from "@/lib/cn";
import { homeList, resolveHomeContent } from "@/lib/home-content";
import { todayStatusSentence } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, categories, featured, gallery, hours, exceptions] =
    await Promise.all([
      getSettings(),
      listPublicCategories(),
      listPublicProducts({ featuredOnly: true, limit: 5 }),
      listGallery({ featuredOnly: true, limit: 6 }),
      getWorkingHours(),
      getUpcomingExceptions(),
    ]);

  const status = todayStatusSentence(hours, exceptions);

  // Owner-editable copy — Админ → Текстове на сайта.
  const copy = resolveHomeContent(settings.homeContent);
  const steps = [
    [copy.step1Title, copy.step1Text],
    [copy.step2Title, copy.step2Text],
    [copy.step3Title, copy.step3Text],
    [copy.step4Title, copy.step4Text],
  ].filter(([title, body]) => title || body);
  const credentials = [
    [copy.credential1Title, copy.credential1Text],
    [copy.credential2Title, copy.credential2Text],
    [
      copy.credential3Title || settings.city,
      copy.credential3Text || settings.addressLine || "локална сладкарска работа",
    ],
  ].filter(([term, description]) => term || description);
  const marquee = homeList(copy.marqueeItems);
  const builderPoints = homeList(copy.builderPoints);
  const heroCategories = categories.slice(0, 4);
  const mapsHost = settings.mapsUrl;

  // The hero is photographic. Featured work is the best-lit material the
  // owner has, so it is what leads — with the gallery as the fallback for
  // a catalogue that has not been filled in yet.
  const heroImages = [
    ...featured.map((p) => p.images[0]).filter(Boolean),
    ...gallery,
  ].slice(0, 3);

  return (
    <>
      {/* ============================================================ Hero */}
      <section className="relative overflow-hidden bg-cream pb-16 pt-8 lg:pb-24 lg:pt-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16">
            {/* ------------------------------------------------ Statement */}
            <div className="relative z-10 lg:pr-4">
              {settings.heroEyebrow ? (
                <div className="flex items-center gap-4">
                  <span aria-hidden="true" className="h-px w-10 bg-rose-dark" />
                  <Label>{settings.heroEyebrow}</Label>
                </div>
              ) : null}

              <h1 className="display-1 mt-7">
                {settings.heroTitle}
                {settings.heroTitleAccent ? (
                  <em className="display-italic mt-1 block text-rose-dark">
                    {settings.heroTitleAccent}
                  </em>
                ) : null}
              </h1>

              <p className="lede mt-7 max-w-[46ch]">{settings.heroSubtitle}</p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                {copy.heroPrimaryCta ? (
                  <ButtonLink href="/order?mode=custom" variant="rose" size="lg">
                    {copy.heroPrimaryCta}
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                ) : null}
                {copy.heroSecondaryCta ? (
                  <ButtonLink href="/menu" variant="outline" size="lg">
                    {copy.heroSecondaryCta}
                  </ButtonLink>
                ) : null}
              </div>

              {/* Credentials, set as a printed colophon rather than as
                  three identical stat boxes. */}
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-6 border-t border-line pt-7">
                {credentials.map(([term, description], index) => (
                  <div key={index} className="min-w-[128px]">
                    <dt className="font-[family-name:var(--font-display)] text-[1.24rem] leading-tight">
                      {term}
                    </dt>
                    <dd className="mt-1 text-[0.76rem] uppercase tracking-[0.13em] text-ink-faint">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* --------------------------------------------- Photography */}
            <HeroComposition images={heroImages} city={settings.city} />
          </div>
        </Container>
      </section>

      {marquee.length > 0 ? <Marquee items={marquee} /> : null}

      {/* ====================================================== Signature */}
      {featured.length > 0 ? (
        <Section tone="cream">
          <Container>
            <SectionHeading
              eyebrow={copy.featuredEyebrow || undefined}
              title={
                <Headline title={copy.featuredTitle} accent={copy.featuredAccent} />
              }
              intro={copy.featuredIntro || undefined}
              action={
                copy.featuredLink ? (
                  <Link
                    href="/menu"
                    className="link-underline text-[0.76rem] font-bold uppercase tracking-[0.18em] text-rose-dark"
                  >
                    {copy.featuredLink}
                  </Link>
                ) : undefined
              }
            />

            {/* Editorial split: one large plate, then the supporting run.
                An equal three-across grid is what made this read as stock. */}
            <div className="mt-14 grid gap-x-8 gap-y-14 lg:grid-cols-[1.25fr_1fr] lg:gap-x-14">
              <ProductCard
                product={featured[0]}
                showCategory
                ratio="aspect-[4/3] lg:aspect-[16/13]"
              />
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
                {featured.slice(1, 3).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showCategory
                  />
                ))}
              </div>
            </div>

            {featured.length > 3 ? (
              <div className="mt-14 grid gap-x-8 gap-y-12 border-t border-line pt-14 sm:grid-cols-2 lg:grid-cols-3">
                {featured.slice(3).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showCategory
                  />
                ))}
              </div>
            ) : null}
          </Container>
        </Section>
      ) : null}

      {/* ================================================= Custom builder */}
      <Section tone="ink" size="lg">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:gap-20">
            <div>
              {copy.builderEyebrow ? (
                <div className="flex items-center gap-4">
                  <span aria-hidden="true" className="h-px w-10 bg-gold" />
                  <Label tone="light">{copy.builderEyebrow}</Label>
                </div>
              ) : null}

              <h2 className="display-2 mt-6 text-paper">
                <Headline
                  title={copy.builderTitle}
                  accent={copy.builderAccent}
                  accentClassName="text-[#e7c9a8]"
                />
              </h2>

              {copy.builderText ? (
                <p className="mt-7 max-w-[46ch] whitespace-pre-line text-[1.04rem] leading-relaxed text-[#d6c6bb]">
                  {copy.builderText}
                </p>
              ) : null}

              {builderPoints.length > 0 ? (
              <ol className="mt-10 divide-y divide-[#4a3730] border-y border-[#4a3730]">
                {builderPoints.map((item, index) => (
                  <li key={index} className="flex items-baseline gap-5 py-4">
                    <span
                      aria-hidden="true"
                      className="numeral flex-none text-[0.75rem] text-[#a08b7f]"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[0.94rem] text-[#cbbab0]">{item}</span>
                  </li>
                ))}
              </ol>
              ) : null}

              {copy.builderCta ? (
                <div className="mt-10">
                  <ButtonLink
                    href="/order?mode=custom"
                    variant="ghost"
                    size="lg"
                    className="border-paper/25 bg-transparent text-paper hover:border-paper hover:bg-paper hover:text-ink"
                  >
                    {copy.builderCta}
                    <ArrowRight size={16} aria-hidden="true" />
                  </ButtonLink>
                </div>
              ) : null}
            </div>

            <ConfiguratorTeaser />
          </div>
        </Container>
      </Section>

      {/* ======================================================= Menu index */}
      <Section tone="cream">
        <Container>
          <SectionHeading
            eyebrow={copy.menuEyebrow || undefined}
            title={<Headline title={copy.menuTitle} accent={copy.menuAccent} />}
            intro={copy.menuIntro || undefined}
          />

          <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {heroCategories.map((category, index) => (
              <CategoryCard
                key={category.id}
                category={category}
                productCount={category.productCount}
                index={index}
              />
            ))}
          </div>

          {categories.length > heroCategories.length ? (
            <div className="mt-14 border-t border-line pt-8">
              <Link
                href="/menu"
                className="link-underline text-[0.78rem] font-bold uppercase tracking-[0.18em] text-rose-dark"
              >
                Виж всички {categories.length} категории
              </Link>
            </div>
          ) : null}
        </Container>
      </Section>

      {/* ========================================================= Gallery */}
      {gallery.length > 0 ? (
        <Section tone="stone">
          <Container>
            <SectionHeading
              eyebrow={copy.galleryEyebrow || undefined}
              title={
                <Headline title={copy.galleryTitle} accent={copy.galleryAccent} />
              }
              intro={copy.galleryIntro || undefined}
              action={
                copy.galleryLink ? (
                  <Link
                    href="/gallery"
                    className="link-underline text-[0.76rem] font-bold uppercase tracking-[0.18em] text-rose-dark"
                  >
                    {copy.galleryLink}
                  </Link>
                ) : undefined
              }
            />

            {/* Deliberately uneven: two tall plates flanking a stack. */}
            <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
              {gallery.slice(0, 6).map((item, index) => (
                <Link
                  key={item.id}
                  href="/gallery"
                  className={cnGallery(index)}
                  aria-label={item.caption || "Виж галерията"}
                >
                  <Image
                    src={item.path}
                    alt={item.caption || ""}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-cocoa-deep/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  {item.caption ? (
                    <span className="absolute inset-x-4 bottom-4 translate-y-2 font-[family-name:var(--font-display)] text-[1rem] leading-snug text-paper opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      {item.caption}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* =========================================================== About */}
      {settings.aboutText ? (
        <Section tone="cream" size="lg">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.42fr_0.58fr] lg:gap-20">
              <div>
                {settings.aboutEyebrow ? (
                  <Label className="mb-5 block">{settings.aboutEyebrow}</Label>
                ) : null}
                <h2 className="display-2 whitespace-pre-line">
                  {settings.aboutTitle}
                </h2>
              </div>

              <div className="lg:pt-3">
                <p className="whitespace-pre-line text-[1.06rem] leading-[1.75] text-ink-soft">
                  {settings.aboutText}
                </p>

                {settings.aboutQuote ? (
                  <blockquote className="mt-10 border-l-2 border-rose-dark pl-7">
                    <p className="font-[family-name:var(--font-display)] text-[clamp(1.4rem,2.2vw,1.85rem)] italic leading-[1.35] text-ink">
                      „{settings.aboutQuote}“
                    </p>
                  </blockquote>
                ) : null}

                {copy.aboutCta ? (
                  <div className="mt-11">
                    <ButtonLink href="/order" variant="outline">
                      {copy.aboutCta}
                      <ArrowRight size={15} aria-hidden="true" />
                    </ButtonLink>
                  </div>
                ) : null}
              </div>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ========================================================= Process */}
      <Section tone="paper" size="sm">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.34fr_0.66fr] lg:gap-16">
            <div className="border-t border-line pt-7">
              {copy.processEyebrow ? <Label>{copy.processEyebrow}</Label> : null}
              <h2 className="display-3 mt-4 whitespace-pre-line">
                {copy.processTitle}
              </h2>
            </div>

            <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {steps.map(([title, body], index) => (
                <li key={index} className="border-t border-line pt-6">
                  <div className="flex items-baseline gap-4">
                    <span
                      aria-hidden="true"
                      className="numeral flex-none text-[0.75rem] text-rose-dark"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="display-4">{title}</h3>
                      <p className="mt-2 whitespace-pre-line text-[0.88rem] leading-relaxed text-ink-soft">
                        {body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      {/* ========================================================= Contact */}
      <Section tone="cream" size="md">
        <Container>
          <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-line lg:grid-cols-2">
            <div className="flex flex-col justify-between gap-10 bg-cocoa p-9 text-paper sm:p-12">
              <div>
                {copy.contactEyebrow ? (
                  <Label tone="light">{copy.contactEyebrow}</Label>
                ) : null}
                <h2 className="display-3 mt-4 whitespace-pre-line text-paper">
                  {copy.contactTitle}
                </h2>
                {copy.contactText ? (
                  <p className="mt-4 max-w-[38ch] whitespace-pre-line text-[0.94rem] leading-relaxed text-[#c9b8ad]">
                    {copy.contactText}
                  </p>
                ) : null}
              </div>

              {settings.phone ? (
                <a
                  href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                  className="numeral block font-[family-name:var(--font-display)] text-[clamp(1.9rem,4.4vw,2.9rem)] leading-none transition-opacity hover:opacity-75"
                >
                  {settings.phone}
                </a>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-5 border-t border-[#4a3730] pt-6">
                <p className="text-[0.82rem] text-[#b8a79c]">{status.text}</p>
                <SocialLinks
                  facebookUrl={settings.facebookUrl}
                  instagramUrl={settings.instagramUrl}
                  tone="dark"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-10 bg-paper p-9 sm:p-12">
              <div>
                {copy.studioEyebrow ? <Label>{copy.studioEyebrow}</Label> : null}
                <h2 className="display-3 mt-4">{settings.businessName}</h2>
                {settings.addressLine ? (
                  <p className="mt-5 flex items-start gap-3 text-[0.96rem] leading-relaxed text-ink-soft">
                    <MapPin
                      size={16}
                      aria-hidden="true"
                      className="mt-1 flex-none text-rose-dark"
                    />
                    <span>
                      {settings.addressLine}
                      <br />
                      {settings.city}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                {copy.studioOrderCta ? (
                  <ButtonLink href="/order" variant="rose">
                    {copy.studioOrderCta}
                  </ButtonLink>
                ) : null}
                {mapsHost && copy.studioMapCta ? (
                  <ExternalButtonLink href={mapsHost} variant="outline">
                    {copy.studioMapCta}
                  </ExternalButtonLink>
                ) : null}
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A section title as the owner typed it: line breaks kept, and the accent —
 * when there is one — on its own line in the italic display face.
 */
function Headline({
  title,
  accent,
  accentClassName,
}: {
  title: string;
  accent: string;
  accentClassName?: string;
}) {
  return (
    <>
      {title ? <span className="whitespace-pre-line">{title}</span> : null}
      {title && accent ? <br /> : null}
      {accent ? (
        <em className={cn("display-italic", accentClassName)}>{accent}</em>
      ) : null}
    </>
  );
}

/** Uneven gallery cells — index drives which tile gets the tall crop. */
function cnGallery(index: number): string {
  const base =
    "frame group relative block bg-cocoa/10 " +
    "transition-[border-radius] duration-300";
  if (index === 0) return `${base} col-span-2 row-span-2 aspect-square lg:col-span-2`;
  if (index === 3) return `${base} aspect-[3/4] lg:row-span-2 lg:aspect-auto`;
  return `${base} aspect-square`;
}

/**
 * Overlapping photographic composition for the hero.
 *
 * Three real photographs at different scales, tilted off the grid, rather
 * than one illustrated cake centred in a pastel circle. Falls back
 * gracefully when the catalogue has fewer images.
 */
function HeroComposition({
  images,
  city,
}: {
  images: { path: string; alt?: string | null; caption?: string | null }[];
  city: string;
}) {
  const [lead, second, third] = images;

  if (!lead) {
    return (
      <div
        aria-hidden="true"
        className="frame aspect-[4/5] w-full bg-[linear-gradient(150deg,#e8d3d1,#a9854e)]"
      />
    );
  }

  return (
    <div className="relative">
      {/* Lead plate */}
      <div className="frame reveal relative aspect-[4/5] w-full sm:aspect-[5/6] lg:ml-auto lg:w-[86%]">
        <Image
          src={lead.path}
          alt={lead.alt || lead.caption || ""}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 46vw"
          className="object-cover"
        />
      </div>

      {/* Inset plate, overlapping the lead's lower-left corner */}
      {second ? (
        <div className="frame absolute -bottom-8 left-0 hidden w-[42%] sm:block lg:-bottom-10 lg:w-[38%]">
          <div className="relative aspect-square">
            <Image
              src={second.path}
              alt=""
              fill
              sizes="20vw"
              className="object-cover"
            />
          </div>
        </div>
      ) : null}

      {/* Small accent plate, top-left */}
      {third ? (
        <div className="frame absolute -top-6 left-2 hidden w-[26%] lg:block">
          <div className="relative aspect-[3/4]">
            <Image
              src={third.path}
              alt=""
              fill
              sizes="14vw"
              className="object-cover"
            />
          </div>
        </div>
      ) : null}

      {/* Editorial caption tag */}
      <span className="absolute -bottom-4 right-0 hidden items-center gap-3 bg-cream py-2 pl-5 sm:flex lg:-bottom-5">
        <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
        <span className="text-[0.62rem] uppercase tracking-[0.26em] text-ink-faint">
          Ателие · {city}
        </span>
      </span>
    </div>
  );
}

/**
 * Static twin of the live configurator, used as a teaser.
 *
 * It shows the two halves the real builder has — the running choice list
 * and the drawing — so the section sells the actual experience rather
 * than a decorative illustration.
 */
function ConfiguratorTeaser() {
  return (
    <div className="relative">
      <div className="rounded-[var(--radius-lg)] border border-[#4a3730] bg-[#33241e] p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 border-b border-[#4a3730] pb-4">
          <span className="text-[0.62rem] uppercase tracking-[0.24em] text-[#a08b7f]">
            Вашият десерт
          </span>
          <span className="numeral text-[0.72rem] text-[#e7c9a8]">06 / 06</span>
        </div>

        <div className="mt-6 grid gap-7 sm:grid-cols-[1fr_1.05fr] sm:items-center">
          <ul className="space-y-0">
            {[
              ["Вид", "Торта"],
              ["Етажи", "2 етажа"],
              ["Блат", "Шоколадов"],
              ["Крем", "Шамфъстък"],
              ["Покритие", "Бял крем"],
              ["Декорация", "Ягоди, злато"],
            ].map(([term, value]) => (
              <li
                key={term}
                className="flex items-baseline justify-between gap-4 border-b border-[#4a3730] py-2.5 last:border-0"
              >
                <span className="text-[0.78rem] uppercase tracking-[0.12em] text-[#9a857a]">
                  {term}
                </span>
                <span className="text-right text-[0.88rem] font-semibold text-paper">
                  {value}
                </span>
              </li>
            ))}
          </ul>

          <div className="aspect-square">
            <TeaserSvg />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cropped to the drawing itself so it fills its panel, not floats in it. */
function TeaserSvg() {
  return (
    <svg viewBox="34 135 332 332" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="teaser-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8dcca" />
          <stop offset="30%" stopColor="#fdf6ec" />
          <stop offset="70%" stopColor="#fffdf9" />
          <stop offset="100%" stopColor="#e0d2be" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="440" rx="140" ry="22" fill="#180f0c" opacity="0.35" />
      <ellipse cx="200" cy="393" rx="132" ry="19" fill="#f0dcc0" />
      <path d="M97 276 L97 386 A103 12 0 0 0 303 386 L303 276 Z" fill="url(#teaser-body)" />
      <ellipse cx="200" cy="276" rx="103" ry="12" fill="#fffdf9" />
      <rect x="97" y="364" width="206" height="4" fill="#a9854e" opacity="0.9" />
      <path d="M124 172 L124 268 A76 9 0 0 0 276 268 L276 172 Z" fill="url(#teaser-body)" />
      <ellipse cx="200" cy="172" rx="76" ry="9" fill="#fffdf9" />
      {[150, 180, 210, 240].map((x, i) => (
        <g key={x} transform={`translate(${x} ${166 - (i % 2) * 5})`}>
          <path
            d="M0 -9 C 9 -9 13 -2 12 5 C 11 13 5 19 0 21 C -5 19 -11 13 -12 5 C -13 -2 -9 -9 0 -9 Z"
            fill="#97303b"
          />
          <path d="M-9 -9 L-2 -12 L0 -18 L2 -12 L9 -9 L2 -6 L0 -4 L-2 -6 Z" fill="#82896f" />
        </g>
      ))}
      <path d="M262 196 l9 -5 l-2 10 l8 -4 l-7 12 l-9 2 l3 -8 z" fill="#a9854e" />
      <path d="M128 300 l9 -5 l-2 10 l8 -4 l-7 12 l-9 2 l3 -8 z" fill="#a9854e" />
    </svg>
  );
}
