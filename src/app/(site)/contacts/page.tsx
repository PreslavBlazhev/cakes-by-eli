import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { SocialLinks } from "@/components/site/SocialLinks";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/Button";
import {
  Badge,
  Container,
  Eyebrow,
  Section,
} from "@/components/ui/primitives";
import { formatDate, shortTime } from "@/lib/format";
import { WEEKDAY_LABELS } from "@/lib/labels";
import { todayStatusSentence } from "@/lib/schedule";
import {
  getSettings,
  getUpcomingExceptions,
  getWorkingHours,
} from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "Контакти",
    description: `Телефон, адрес и работно време на ${settings.businessName} в ${settings.city}.`,
    alternates: { canonical: "/contacts" },
    openGraph: {
      title: `Контакти · ${settings.businessName}`,
      description: settings.contactIntro,
      url: "/contacts",
    },
  };
}

export default async function ContactsPage() {
  const [settings, hours, exceptions] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    getUpcomingExceptions(),
  ]);

  const status = todayStatusSentence(hours, exceptions);
  const phoneHref = settings.phone
    ? `tel:${settings.phone.replace(/[^\d+]/g, "")}`
    : null;

  return (
    <>
      <section className="relative overflow-hidden pb-6 pt-14 lg:pt-20">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-44 -z-10 size-[360px] rounded-full bg-blush opacity-55"
        />
        <Container>
          <Eyebrow>Контакти</Eyebrow>
          <h1 className="display-1 mt-4">
            Нека уточним
            <br />
            вашата идея.
          </h1>
          {settings.contactIntro ? (
            <p className="lede mt-5 max-w-[720px] text-[1.06rem]">
              {settings.contactIntro}
            </p>
          ) : null}
        </Container>
      </section>

      <Section tone="cream" className="pt-10">
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Phone card */}
            <div className="flex flex-col justify-between rounded-[var(--radius-lg)] bg-cocoa p-8 text-paper sm:p-10">
              <div>
                <span className="eyebrow text-[#e7b7bd]">Телефон</span>
                <h2 className="display-3 mt-3 text-paper">Поръчки и въпроси</h2>
                <p className="mt-3 text-[0.95rem] text-[#d8cbc4]">
                  Най-бързият начин за уточняване на свободна дата и основните
                  детайли по поръчката.
                </p>
              </div>
              {settings.phone && phoneHref ? (
                <a
                  href={phoneHref}
                  className="mt-8 flex items-center gap-3 font-[family-name:var(--font-display)] text-[clamp(1.8rem,5vw,2.9rem)] leading-none transition-opacity hover:opacity-80"
                >
                  <Phone size={26} aria-hidden="true" className="flex-none" />
                  {settings.phone}
                </a>
              ) : (
                <p className="mt-8 text-[0.95rem] text-[#d8cbc4]">
                  Телефонът ще бъде добавен скоро.
                </p>
              )}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                <Badge tone={status.isOpen ? "positive" : "muted"}>
                  {status.text}
                </Badge>
                <SocialLinks
                  facebookUrl={settings.facebookUrl}
                  instagramUrl={settings.instagramUrl}
                  tone="dark"
                />
              </div>
            </div>

            {/* Address card */}
            <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-paper p-8 sm:p-10">
              <div>
                <Eyebrow>Адрес</Eyebrow>
                <h2 className="display-3 mt-3">{settings.businessName}</h2>
                {settings.addressLine ? (
                  <p className="mt-4 flex items-start gap-2.5 text-[1rem] text-ink-soft">
                    <MapPin
                      size={18}
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
                {settings.email ? (
                  <p className="mt-3 flex items-start gap-2.5 text-[1rem] text-ink-soft">
                    <Mail
                      size={18}
                      aria-hidden="true"
                      className="mt-1 flex-none text-rose-dark"
                    />
                    <a
                      href={`mailto:${settings.email}`}
                      className="transition-colors hover:text-rose-dark"
                    >
                      {settings.email}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/order" variant="rose">
                  Направи поръчка
                </ButtonLink>
                {settings.mapsUrl ? (
                  <ExternalButtonLink href={settings.mapsUrl} variant="outline">
                    Отвори в Google Maps
                  </ExternalButtonLink>
                ) : null}
              </div>
            </div>
          </div>

          {/* Hours */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="panel p-8 sm:p-10">
              <div className="flex items-center gap-2.5">
                <Clock size={18} aria-hidden="true" className="text-rose-dark" />
                <h2 className="display-3">Работно време</h2>
              </div>

              <ul className="mt-6 divide-y divide-line">
                {hours.map((row) => (
                  <li
                    key={row.weekday}
                    className="flex items-center justify-between gap-4 py-3 text-[0.95rem]"
                  >
                    <span className="font-semibold">
                      {WEEKDAY_LABELS[row.weekday]}
                    </span>
                    <span
                      className={
                        row.isClosed ? "text-ink-faint" : "text-ink-soft"
                      }
                    >
                      {row.isClosed || !row.opensAt || !row.closesAt
                        ? "Почивен ден"
                        : `${shortTime(row.opensAt)} – ${shortTime(row.closesAt)}`}
                    </span>
                  </li>
                ))}
              </ul>

              {status.note ? (
                <p className="mt-5 rounded-[var(--radius-sm)] border border-warning/25 bg-warning-soft px-4 py-3 text-[0.88rem] text-warning">
                  {status.note}
                </p>
              ) : null}
            </div>

            <div className="panel p-8 sm:p-10">
              <h2 className="display-3">Почивки и изключения</h2>
              {exceptions.length === 0 ? (
                <p className="mt-4 text-[0.94rem] text-ink-soft">
                  В момента няма обявени промени в работното време.
                </p>
              ) : (
                <ul className="mt-6 space-y-3">
                  {exceptions.slice(0, 8).map((exception) => (
                    <li
                      key={exception.date}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3 last:border-0"
                    >
                      <span className="font-semibold">
                        {formatDate(exception.date)}
                      </span>
                      <span className="text-[0.9rem] text-ink-soft">
                        {exception.isClosed
                          ? "Затворено"
                          : `${shortTime(exception.opensAt)} – ${shortTime(exception.closesAt)}`}
                      </span>
                      {exception.note ? (
                        <span className="w-full text-[0.84rem] text-ink-faint">
                          {exception.note}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
