import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Phone, Sparkles } from "lucide-react";

import { CategoryCard, ProductCard } from "@/components/site/cards";
import { HeroScene } from "@/components/site/HeroScene";
import { Marquee } from "@/components/site/Marquee";
import { SocialLinks } from "@/components/site/SocialLinks";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/Button";
import {
  Container,
  Eyebrow,
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
import { todayStatusSentence } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Избирате продукт или създавате свой",
    body: "Разгледайте менюто или отворете конфигуратора и съставете десерта си стъпка по стъпка.",
  },
  {
    title: "Попълвате детайлите",
    body: "Повод, дата, брой порции, вкусове и всичко важно за поръчката.",
  },
  {
    title: "Cakes by ELI потвърждава",
    body: "Свързваме се с вас, уточняваме възможностите и потвърждаваме поръчката.",
  },
  {
    title: "Получавате готовия десерт",
    body: "Вземане на място в Плевен или доставка с Еконт, където е приложимо.",
  },
];

export default async function HomePage() {
  const [settings, categories, featured, gallery, hours, exceptions] =
    await Promise.all([
      getSettings(),
      listPublicCategories(),
      listPublicProducts({ featuredOnly: true, limit: 3 }),
      listGallery({ featuredOnly: true, limit: 5 }),
      getWorkingHours(),
      getUpcomingExceptions(),
    ]);

  const status = todayStatusSentence(hours, exceptions);
  const heroCategories = categories.slice(0, 4);
  const mapsHost = settings.mapsUrl;

  return (
    <>
      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden pb-16 pt-10 lg:pb-24 lg:pt-16">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-28 size-[520px] rounded-full bg-blush opacity-55 blur-[4px]"
        />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              {settings.heroEyebrow ? (
                <Eyebrow>{settings.heroEyebrow}</Eyebrow>
              ) : null}

              <h1 className="display-1 mt-5">
                {settings.heroTitle}
                {settings.heroTitleAccent ? (
                  <em className="block font-normal not-italic text-rose-dark">
                    {settings.heroTitleAccent}
                  </em>
                ) : null}
              </h1>

              <p className="lede mt-6 max-w-[640px] text-[1.06rem]">
                {settings.heroSubtitle}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/menu" variant="rose" size="lg">
                  Разгледай менюто
                  <ArrowRight size={17} aria-hidden="true" />
                </ButtonLink>
                <ButtonLink href="/order" variant="outline" size="lg">
                  Направи поръчка
                </ButtonLink>
                {settings.phone ? (
                  <a
                    href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex min-h-14 items-center gap-2 px-2 text-[0.95rem] font-semibold text-ink-soft transition-colors hover:text-ink"
                  >
                    <Phone size={16} aria-hidden="true" />
                    {settings.phone}
                  </a>
                ) : null}
              </div>

              <dl className="mt-11 flex flex-wrap gap-x-9 gap-y-5 border-t border-line pt-6">
                <div className="min-w-[120px]">
                  <dt className="font-[family-name:var(--font-display)] text-[1.35rem]">
                    по поръчка
                  </dt>
                  <dd className="text-[0.79rem] text-ink-soft">
                    индивидуален дизайн
                  </dd>
                </div>
                <div className="min-w-[120px]">
                  <dt className="font-[family-name:var(--font-display)] text-[1.35rem]">
                    ръчна изработка
                  </dt>
                  <dd className="text-[0.79rem] text-ink-soft">
                    внимание към детайла
                  </dd>
                </div>
                <div className="min-w-[120px]">
                  <dt className="font-[family-name:var(--font-display)] text-[1.35rem]">
                    {settings.city}
                  </dt>
                  <dd className="text-[0.79rem] text-ink-soft">
                    {settings.addressLine || "локална сладкарска работа"}
                  </dd>
                </div>
              </dl>
            </div>

            <HeroScene />
          </div>
        </Container>
      </section>

      <Marquee
        items={[
          "Бутикови торти",
          "Еклери",
          "Макарони",
          "Къпкейкове",
          "Декорирани бисквити",
          "Сладки барове",
        ]}
      />

      {/* ------------------------------------------------------ Categories */}
      <Section tone="cream">
        <Container>
          <SectionHeading
            eyebrow="Меню"
            title={
              <>
                Изберете вида
                <br />
                десерт.
              </>
            }
            intro="Всяка категория води към конкретните предложения. От там можете да поръчате директно или да отворите конфигуратора."
          />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="mt-10 flex justify-center">
              <ButtonLink href="/menu" variant="ghost" size="md">
                Виж всички {categories.length} категории
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
            </div>
          ) : null}
        </Container>
      </Section>

      {/* --------------------------------------------------- Custom order */}
      <Section tone="blush">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <Eyebrow>Само тук</Eyebrow>
              <h2 className="display-2 mt-4">
                Създай
                <br />
                своя десерт.
              </h2>
              <p className="lede mt-5 text-[1.05rem]">
                Изберете вид, вкус, размер, цветове и декорация и вижте как вашият
                десерт се променя в реално време.
              </p>

              <ul className="mt-7 space-y-3">
                {[
                  "Формата, етажите и покритието се сменят на живо.",
                  "Цветовете на крема и декорацията се виждат веднага.",
                  "Обобщението на поръчката се обновява с всеки избор.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Sparkles
                      size={16}
                      aria-hidden="true"
                      className="mt-1 flex-none text-rose-dark"
                    />
                    <span className="text-[0.95rem] text-ink-soft">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9">
                <ButtonLink href="/order?mode=custom" variant="rose" size="lg">
                  Създай персонална поръчка
                  <ArrowRight size={17} aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>

            <div className="relative">
              <div className="panel overflow-hidden bg-paper/80 p-6 shadow-[var(--shadow-card)] backdrop-blur">
                <div className="grid gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-center">
                  <ul className="space-y-2.5 text-[0.86rem]">
                    {[
                      ["Вид", "Торта"],
                      ["Етажи", "2 етажа"],
                      ["Блат", "Шоколадов"],
                      ["Крем", "Шамфъстък"],
                      ["Покритие", "Бял крем"],
                      ["Декорация", "Ягоди, златни детайли"],
                    ].map(([label, value]) => (
                      <li
                        key={label}
                        className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0"
                      >
                        <span className="text-ink-faint">{label}</span>
                        <span className="text-right font-semibold">{value}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="aspect-square">
                    <PreviewTeaser />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------- Selected work */}
      {featured.length > 0 ? (
        <Section tone="cream">
          <Container>
            <SectionHeading
              eyebrow="Избрани предложения"
              title={
                <>
                  Малки детайли.
                  <br />
                  Големи поводи.
                </>
              }
              intro="Няколко от текущите предложения. Всяко от тях може да бъде адаптирано към вашия повод."
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} showCategory />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* -------------------------------------------------------- Gallery */}
      {gallery.length > 0 ? (
        <Section tone="ink">
          <Container>
            <div className="mb-11 grid items-end gap-8 lg:grid-cols-[1fr_0.75fr]">
              <div>
                <span className="eyebrow text-[#e7b7c0]">Галерия</span>
                <h2 className="display-2 mt-3">
                  Изработено
                  <br />
                  специално за вас.
                </h2>
              </div>
              <p className="text-[1.02rem] text-[#d7c9c1]">
                Подбрани проекти от работата на {settings.businessName}.
              </p>
            </div>

            <div className="grid auto-rows-[168px] grid-cols-2 gap-4 lg:grid-cols-4">
              {gallery.slice(0, 5).map((item, index) => (
                <Link
                  key={item.id}
                  href="/gallery"
                  className={[
                    "group relative overflow-hidden rounded-[var(--radius-md)] bg-[#4b3730]",
                    index === 0 ? "row-span-2 lg:col-span-2" : "",
                    index === 3 ? "lg:row-span-2" : "",
                  ].join(" ")}
                >
                  <Image
                    src={item.path}
                    alt={item.caption || ""}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-[#180d0a]/65 to-transparent" />
                  {item.caption ? (
                    <span className="absolute bottom-4 left-4 right-4 font-[family-name:var(--font-display)] text-[1.05rem] text-paper">
                      {item.caption}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>

            <div className="mt-10">
              <ButtonLink
                href="/gallery"
                variant="ghost"
                size="md"
                className="border-paper/25 bg-transparent text-paper hover:bg-paper hover:text-ink"
              >
                Виж цялата галерия
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------- About */}
      {settings.aboutText ? (
        <Section tone="cream">
          <Container>
            <div className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]">
              <div
                aria-hidden="true"
                className="relative min-h-[420px] overflow-hidden rounded-t-[220px] rounded-b-[28px] bg-[linear-gradient(160deg,#e7cabf,#b97877)] shadow-[var(--shadow-card)] lg:min-h-[560px]"
              >
                <span className="absolute left-1/2 top-20 size-56 -translate-x-1/2 rounded-full bg-[#f8e5da]" />
                <span className="absolute -bottom-20 left-1/2 size-[430px] -translate-x-1/2 rounded-[50%_50%_42%_42%] bg-cocoa" />
                <span className="absolute bottom-0 left-1/2 h-80 w-64 -translate-x-1/2 rounded-t-[90px] bg-[#f6ede2] [clip-path:polygon(20%_0,80%_0,100%_100%,0_100%)]" />
              </div>

              <div>
                {settings.aboutEyebrow ? (
                  <Eyebrow>{settings.aboutEyebrow}</Eyebrow>
                ) : null}
                <h2 className="display-2 mt-4 whitespace-pre-line">
                  {settings.aboutTitle}
                </h2>
                <p className="lede mt-5 whitespace-pre-line">
                  {settings.aboutText}
                </p>

                {settings.aboutQuote ? (
                  <blockquote className="my-8 border-y border-line py-7">
                    <p className="font-[family-name:var(--font-display)] text-[1.5rem] italic leading-snug text-ink">
                      „{settings.aboutQuote}“
                    </p>
                  </blockquote>
                ) : null}

                <ButtonLink href="/order" variant="rose">
                  Разкажи ми за повода
                  <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- Process */}
      <Section tone="paper">
        <Container>
          <SectionHeading
            eyebrow="Как става"
            title={
              <>
                От идея
                <br />
                до готов десерт.
              </>
            }
            intro="Четири стъпки, без излишни съобщения напред-назад."
          />

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="panel-sm flex flex-col gap-3 border-line bg-cream/60 p-6"
              >
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-full bg-ink font-[family-name:var(--font-display)] text-[1.15rem] text-paper"
                >
                  {index + 1}
                </span>
                <h3 className="text-[1.05rem] font-bold leading-snug">
                  {step.title}
                </h3>
                <p className="text-[0.88rem] text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* --------------------------------------------------------- Contact */}
      <Section tone="cream">
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col justify-between rounded-[var(--radius-lg)] bg-cocoa p-8 text-paper sm:p-10">
              <div>
                <span className="eyebrow text-[#e7b7bd]">Телефон</span>
                <h2 className="display-3 mt-3 text-paper">Поръчки и въпроси</h2>
                <p className="mt-3 text-[0.95rem] text-[#d8cbc4]">
                  Най-бързият начин за уточняване на свободна дата и основните
                  детайли.
                </p>
              </div>
              {settings.phone ? (
                <a
                  href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                  className="mt-8 block font-[family-name:var(--font-display)] text-[clamp(1.9rem,5vw,3rem)] leading-none transition-opacity hover:opacity-80"
                >
                  {settings.phone}
                </a>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-[0.85rem] text-[#c5b6af]">{status.text}</p>
                <SocialLinks
                  facebookUrl={settings.facebookUrl}
                  instagramUrl={settings.instagramUrl}
                  tone="dark"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-paper p-8 sm:p-10">
              <div>
                <Eyebrow>Адрес</Eyebrow>
                <h2 className="display-3 mt-3">{settings.businessName}</h2>
                {settings.addressLine ? (
                  <p className="mt-3 flex items-start gap-2 text-[0.98rem] text-ink-soft">
                    <MapPin
                      size={17}
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

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/order" variant="rose">
                  Направи поръчка
                </ButtonLink>
                {mapsHost ? (
                  <ExternalButtonLink href={mapsHost} variant="outline">
                    Виж на картата
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

/** Static, non-interactive twin of the live preview used in the promo card. */
function PreviewTeaser() {
  return (
    <div className="h-full w-full">
      <TeaserSvg />
    </div>
  );
}

/** Cropped to the drawing itself so it fills its card, not floats in it. */
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
      <ellipse cx="200" cy="440" rx="140" ry="22" fill="#3a2a25" opacity="0.12" />
      <ellipse cx="200" cy="393" rx="132" ry="19" fill="#f0dcc0" />
      <path d="M97 276 L97 386 A103 12 0 0 0 303 386 L303 276 Z" fill="url(#teaser-body)" />
      <ellipse cx="200" cy="276" rx="103" ry="12" fill="#fffdf9" />
      <rect x="97" y="364" width="206" height="4" fill="#caa779" opacity="0.9" />
      <path d="M124 172 L124 268 A76 9 0 0 0 276 268 L276 172 Z" fill="url(#teaser-body)" />
      <ellipse cx="200" cy="172" rx="76" ry="9" fill="#fffdf9" />
      {[150, 180, 210, 240].map((x, i) => (
        <g key={x} transform={`translate(${x} ${166 - (i % 2) * 5})`}>
          <path
            d="M0 -9 C 9 -9 13 -2 12 5 C 11 13 5 19 0 21 C -5 19 -11 13 -12 5 C -13 -2 -9 -9 0 -9 Z"
            fill="#c8515c"
          />
          <path d="M-9 -9 L-2 -12 L0 -18 L2 -12 L9 -9 L2 -6 L0 -4 L-2 -6 Z" fill="#7d9463" />
        </g>
      ))}
      <path d="M262 196 l9 -5 l-2 10 l8 -4 l-7 12 l-9 2 l3 -8 z" fill="#caa779" />
      <path d="M128 300 l9 -5 l-2 10 l8 -4 l-7 12 l-9 2 l3 -8 z" fill="#caa779" />
    </svg>
  );
}
