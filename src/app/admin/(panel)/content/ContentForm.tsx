"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card } from "@/components/admin/ui";
import { Field, Input, Textarea } from "@/components/ui/form";
import {
  HOME_SECTIONS,
  resolveHomeContent,
  type HomeContent,
  type HomeField,
} from "@/lib/home-content";
import { cn } from "@/lib/cn";
import { HeroImages } from "./HeroImages";
import { saveSiteSettings } from "@/server/admin/site";
import type { LibraryImage } from "@/server/queries/gallery";
import type { SiteSettings } from "@/server/queries/settings";

type SectionId = (typeof HOME_SECTIONS)[number]["id"];

const section = (id: SectionId) => {
  const found = HOME_SECTIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown home section ${id}`);
  return found;
};

/**
 * The home page, top to bottom, followed by the business details.
 *
 * The owner asked where the text on the first page is changed; the answer used
 * to be "partly here, partly in the code". Every card is now numbered in the
 * order the section appears on the site, and the jump list at the top names
 * them the way they look rather than the way they are built.
 */
const JUMPS: [string, string][] = [
  ["home-1", "1. Първи екран"],
  ["home-2", "2. Движеща се лента"],
  ["home-3", "3. Избрани продукти"],
  ["home-4", "4. Създай своя десерт"],
  ["home-5", "5. Категории"],
  ["home-6", "6. Галерия"],
  ["home-7", "7. За Ели"],
  ["home-8", "8. Как става"],
  ["home-9", "9. Контакт най-долу"],
  ["business", "Данни за бизнеса"],
  ["orders", "Контакти и поръчки"],
];

export function ContentForm({
  settings,
  library,
}: {
  settings: SiteSettings;
  library: LibraryImage[];
}) {
  const home = resolveHomeContent(settings.homeContent);

  return (
    <ActionForm action={saveSiteSettings} className="space-y-4">
      {({ pending, fieldErrors }) => (
        <>
          <nav
            aria-label="Секции"
            className="rounded-[var(--radius-md)] border border-line bg-paper px-5 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
                Начална страница — отгоре надолу
              </p>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-rose-dark hover:underline"
              >
                Отвори сайта
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {JUMPS.map(([anchor, label]) => (
                <li key={anchor}>
                  <a
                    href={`#${anchor}`}
                    className="inline-flex min-h-8 items-center rounded-[3px] border border-line px-2.5 text-[0.78rem] font-semibold transition-colors hover:border-ink"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* ---------------------------------------------- 1. Hero */}
          <Anchored id="home-1">
            <Card
              title="1. Първи екран"
              description="Лентата най-отгоре, голямото заглавие, текстът и бутоните под него."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Текст в най-горната лента"
                  hint="Ако има активно съобщение (Админ → Съобщения), то замества този текст."
                  htmlFor="s-topbar"
                  className="sm:col-span-2"
                >
                  <Input
                    id="s-topbar"
                    name="topbarText"
                    defaultValue={settings.topbarText}
                    maxLength={200}
                  />
                </Field>

                <Field
                  label="Надзаглавие"
                  hint="Малкият текст над заглавието."
                  htmlFor="s-hero-eyebrow"
                >
                  <Input
                    id="s-hero-eyebrow"
                    name="heroEyebrow"
                    defaultValue={settings.heroEyebrow}
                    maxLength={80}
                  />
                </Field>

                <Field label="Голямо заглавие" htmlFor="s-hero-title">
                  <Input
                    id="s-hero-title"
                    name="heroTitle"
                    defaultValue={settings.heroTitle}
                    maxLength={80}
                  />
                </Field>

                <Field
                  label="Акцент в заглавието"
                  hint="Показва се на нов ред, в розово."
                  htmlFor="s-hero-accent"
                >
                  <Input
                    id="s-hero-accent"
                    name="heroTitleAccent"
                    defaultValue={settings.heroTitleAccent}
                    maxLength={80}
                  />
                </Field>

                <Field
                  label="Текст под заглавието"
                  htmlFor="s-hero-sub"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="s-hero-sub"
                    name="heroSubtitle"
                    defaultValue={settings.heroSubtitle}
                    maxLength={400}
                    className="min-h-24"
                  />
                </Field>

                <HeroImages chosen={settings.heroImages} library={library} />

                <HomeFields fields={section("hero-extra").fields} values={home} />
              </div>
            </Card>
          </Anchored>

          <HomeCard id="home-2" number={2} sectionId="marquee" values={home} />
          <HomeCard id="home-3" number={3} sectionId="featured" values={home} />
          <HomeCard id="home-4" number={4} sectionId="builder" values={home} />
          <HomeCard id="home-5" number={5} sectionId="menu" values={home} />
          <HomeCard id="home-6" number={6} sectionId="gallery" values={home} />

          {/* --------------------------------------------- 7. About */}
          <Anchored id="home-7">
            <Card
              title="7. За Ели"
              description="Оставете текста празен, ако не искате секцията да се показва."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Надзаглавие" htmlFor="s-about-eyebrow">
                  <Input
                    id="s-about-eyebrow"
                    name="aboutEyebrow"
                    defaultValue={settings.aboutEyebrow}
                    maxLength={80}
                  />
                </Field>

                <Field
                  label="Заглавие"
                  hint="Нов ред в полето — нов ред на сайта."
                  htmlFor="s-about-title"
                >
                  <Textarea
                    id="s-about-title"
                    name="aboutTitle"
                    defaultValue={settings.aboutTitle}
                    maxLength={120}
                    rows={2}
                    className="min-h-0"
                  />
                </Field>

                <Field label="Текст" htmlFor="s-about-text" className="sm:col-span-2">
                  <Textarea
                    id="s-about-text"
                    name="aboutText"
                    defaultValue={settings.aboutText}
                    maxLength={2000}
                    className="min-h-32"
                  />
                </Field>

                <Field label="Цитат" htmlFor="s-about-quote" className="sm:col-span-2">
                  <Input
                    id="s-about-quote"
                    name="aboutQuote"
                    defaultValue={settings.aboutQuote}
                    maxLength={300}
                  />
                </Field>

                <HomeFields fields={section("about-extra").fields} values={home} />
              </div>
            </Card>
          </Anchored>

          <HomeCard id="home-8" number={8} sectionId="process" values={home} />
          <HomeCard id="home-9" number={9} sectionId="contact" values={home} />

          {/* ------------------------------------------- Business */}
          <Anchored id="business">
            <Card
              title="Данни за бизнеса"
              description="Използват се в хедъра, футъра, контактите и имейлите."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Име на бизнеса"
                  required
                  error={fieldErrors.businessName}
                  htmlFor="s-name"
                >
                  <Input
                    id="s-name"
                    name="businessName"
                    defaultValue={settings.businessName}
                    required
                    maxLength={80}
                  />
                </Field>

                <Field label="Подзаглавие" htmlFor="s-tagline">
                  <Input
                    id="s-tagline"
                    name="tagline"
                    defaultValue={settings.tagline}
                    maxLength={80}
                  />
                </Field>

                <Field label="Телефон" htmlFor="s-phone">
                  <Input
                    id="s-phone"
                    name="phone"
                    defaultValue={settings.phone}
                    maxLength={30}
                    placeholder="087 857 6728"
                  />
                </Field>

                <Field
                  label="Имейл за контакт"
                  hint="Показва се публично в сайта."
                  error={fieldErrors.email}
                  htmlFor="s-email"
                >
                  <Input
                    id="s-email"
                    name="email"
                    type="email"
                    defaultValue={settings.email}
                    maxLength={160}
                  />
                </Field>

                <Field label="Адрес" htmlFor="s-address">
                  <Input
                    id="s-address"
                    name="addressLine"
                    defaultValue={settings.addressLine}
                    maxLength={160}
                  />
                </Field>

                <Field label="Град" htmlFor="s-city">
                  <Input
                    id="s-city"
                    name="city"
                    defaultValue={settings.city}
                    maxLength={80}
                  />
                </Field>

                <Field
                  label="Google Maps връзка"
                  hint="Пълен адрес, започващ с https://"
                  htmlFor="s-maps"
                >
                  <Input
                    id="s-maps"
                    name="mapsUrl"
                    defaultValue={settings.mapsUrl}
                    maxLength={500}
                  />
                </Field>

                <Field label="Facebook" htmlFor="s-fb">
                  <Input
                    id="s-fb"
                    name="facebookUrl"
                    defaultValue={settings.facebookUrl}
                    maxLength={500}
                  />
                </Field>

                <Field label="Instagram" htmlFor="s-ig">
                  <Input
                    id="s-ig"
                    name="instagramUrl"
                    defaultValue={settings.instagramUrl}
                    maxLength={500}
                  />
                </Field>
              </div>
            </Card>
          </Anchored>

          {/* ---------------------------------------------- Orders */}
          <Anchored id="orders">
            <Card title="Контакти и поръчки">
              <div className="grid gap-4">
                <Field label="Уводен текст на страница „Контакти“" htmlFor="s-contact">
                  <Textarea
                    id="s-contact"
                    name="contactIntro"
                    defaultValue={settings.contactIntro}
                    maxLength={400}
                    className="min-h-20"
                  />
                </Field>

                <Field
                  label="Текст при поръчка"
                  hint="Показва се в обобщението и в потвърждаващия имейл."
                  htmlFor="s-disclaimer"
                >
                  <Textarea
                    id="s-disclaimer"
                    name="orderDisclaimer"
                    defaultValue={settings.orderDisclaimer}
                    maxLength={400}
                    className="min-h-20"
                  />
                </Field>

                <Field
                  label="Описание за търсачки (meta description)"
                  hint="До 160 знака работят най-добре."
                  htmlFor="s-meta"
                >
                  <Textarea
                    id="s-meta"
                    name="metaDescription"
                    defaultValue={settings.metaDescription}
                    maxLength={300}
                    className="min-h-20"
                  />
                </Field>
              </div>
            </Card>
          </Anchored>

          <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper px-4 py-3 lg:-mx-6 lg:px-6">
            <p className="mr-auto hidden text-[0.8rem] text-ink-soft sm:block">
              Един бутон запазва всички секции на страницата.
            </p>
            <SubmitButton pending={pending}>Запази</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Offsets in-page jumps so the card title is not hidden under the top bar. */
function Anchored({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      {children}
    </div>
  );
}

function HomeCard({
  id,
  number,
  sectionId,
  values,
}: {
  id: string;
  number: number;
  sectionId: SectionId;
  values: HomeContent;
}) {
  const entry = section(sectionId);
  return (
    <Anchored id={id}>
      <Card title={`${number}. ${entry.title}`} description={entry.description}>
        <div className="grid gap-4 sm:grid-cols-2">
          <HomeFields fields={entry.fields} values={values} />
        </div>
      </Card>
    </Anchored>
  );
}

function HomeFields({
  fields,
  values,
}: {
  fields: readonly HomeField[];
  values: HomeContent;
}) {
  return (
    <>
      {fields.map((field) => {
        const inputId = `home-${field.key}`;
        const name = `home.${field.key}`;
        const value = values[field.key as keyof HomeContent];
        const wide = field.wide || field.kind === "list";

        return (
          <Field
            key={field.key}
            label={field.label}
            hint={field.hint}
            htmlFor={inputId}
            className={cn(wide && "sm:col-span-2")}
          >
            {field.kind === "line" ? (
              <Input
                id={inputId}
                name={name}
                defaultValue={value}
                maxLength={field.max}
              />
            ) : (
              <Textarea
                id={inputId}
                name={name}
                defaultValue={value}
                maxLength={field.max}
                rows={field.kind === "list" ? 6 : wide ? 3 : 2}
                className="min-h-0"
              />
            )}
          </Field>
        );
      })}
    </>
  );
}
