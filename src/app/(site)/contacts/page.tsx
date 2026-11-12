import type { Metadata } from "next";
import { Building2, Mail, MapPin } from "lucide-react";

import { PageHeader } from "@/components/site/PageHeader";
import { SocialLinks } from "@/components/site/SocialLinks";
import { ButtonLink, ExternalButtonLink } from "@/components/ui/Button";
import { Badge, Container, Label, Section } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { COMPANY } from "@/lib/company";
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
  const todayIndex = new Date().getDay();

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Начало" },
          { href: "/contacts", label: "Контакти" },
        ]}
        label="Контакти"
        title={
          <>
            Нека уточним
            <br />
            <em className="display-italic">вашата идея.</em>
          </>
        }
        intro={settings.contactIntro || undefined}
        aside={
          <Badge tone={status.isOpen ? "positive" : "muted"}>{status.text}</Badge>
        }
      />

      {/* ------------------------------------------------- Call to action */}
      <Section tone="cream" size="sm" className="pt-0">
        <Container>
          <div className="grid overflow-hidden rounded-[var(--radius-lg)] border border-line lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-between gap-10 bg-cocoa p-9 text-paper sm:p-12">
              <div>
                <Label tone="light">Телефон</Label>
                <h2 className="display-3 mt-4 text-paper">
                  Поръчки
                  <br />и въпроси
                </h2>
                <p className="mt-4 max-w-[36ch] text-[0.94rem] leading-relaxed text-[#c9b8ad]">
                  Най-бързият начин за уточняване на свободна дата и основните
                  детайли по поръчката.
                </p>
              </div>

              {settings.phone && phoneHref ? (
                <a
                  href={phoneHref}
                  className="numeral block font-[family-name:var(--font-display)] text-[clamp(1.9rem,4.6vw,3rem)] leading-none transition-opacity hover:opacity-75"
                >
                  {settings.phone}
                </a>
              ) : (
                <p className="text-[0.95rem] text-[#c9b8ad]">
                  Телефонът ще бъде добавен скоро.
                </p>
              )}

              <div className="border-t border-[#4a3730] pt-6">
                <SocialLinks
                  facebookUrl={settings.facebookUrl}
                  instagramUrl={settings.instagramUrl}
                  tone="dark"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-10 bg-paper p-9 sm:p-12">
              <div>
                <Label>Ателието</Label>
                <h2 className="display-3 mt-4">{settings.businessName}</h2>

                <dl className="mt-7 border-t border-line">
                  {settings.addressLine ? (
                    <div className="flex items-start gap-3 border-b border-line py-4">
                      <dt className="flex-none pt-0.5">
                        <MapPin
                          size={16}
                          aria-hidden="true"
                          className="text-rose-dark"
                        />
                        <span className="sr-only">Адрес</span>
                      </dt>
                      <dd className="text-[0.98rem] leading-relaxed text-ink-soft">
                        {settings.addressLine}
                        <br />
                        {settings.city}
                      </dd>
                    </div>
                  ) : null}
                  {settings.email ? (
                    <div className="flex items-start gap-3 border-b border-line py-4">
                      <dt className="flex-none pt-0.5">
                        <Mail
                          size={16}
                          aria-hidden="true"
                          className="text-rose-dark"
                        />
                        <span className="sr-only">Имейл</span>
                      </dt>
                      <dd className="text-[0.98rem] text-ink-soft">
                        <a
                          href={`mailto:${settings.email}`}
                          className="link-underline transition-colors hover:text-rose-dark"
                        >
                          {settings.email}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-3 border-b border-line py-4">
                    <dt className="flex-none pt-0.5">
                      <Building2
                        size={16}
                        aria-hidden="true"
                        className="text-rose-dark"
                      />
                      <span className="sr-only">Търговец</span>
                    </dt>
                    <dd className="text-[0.98rem] leading-relaxed text-ink-soft">
                      {COMPANY.legalName}
                      <br />
                      ЕИК {COMPANY.eik}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap gap-3">
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
        </Container>
      </Section>

      {/* ------------------------------------------------------- Schedule */}
      <Section tone="paper" size="sm">
        <Container>
          <div className="grid gap-10 border-t border-line pt-9 lg:grid-cols-[0.3fr_0.7fr] lg:gap-16">
            <div>
              <Label>Кога работим</Label>
              <h2 className="display-3 mt-4">
                Работно
                <br />
                време
              </h2>
              {status.note ? (
                <p className="mt-6 border-l-2 border-warning bg-warning-soft px-4 py-3 text-[0.86rem] leading-relaxed text-warning">
                  {status.note}
                </p>
              ) : null}
            </div>

            <div className="grid gap-x-16 gap-y-10 sm:grid-cols-2">
              {/* Weekly hours — today is marked, which is the only thing
                  anyone actually looks for in this table. */}
              <ul>
                {hours.map((row) => {
                  const isToday = row.weekday === todayIndex;
                  return (
                    <li
                      key={row.weekday}
                      className={cn(
                        "flex items-baseline justify-between gap-4 border-b border-line py-3 text-[0.94rem]",
                        isToday && "border-b-ink",
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center gap-2.5",
                          isToday ? "font-bold text-ink" : "text-ink-soft",
                        )}
                      >
                        {isToday ? (
                          <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full bg-rose-dark"
                          />
                        ) : (
                          <span aria-hidden="true" className="size-1.5" />
                        )}
                        {WEEKDAY_LABELS[row.weekday]}
                        {isToday ? <span className="sr-only">(днес)</span> : null}
                      </span>
                      <span
                        className={cn(
                          "numeral",
                          row.isClosed ? "text-ink-faint" : "text-ink-soft",
                          isToday && !row.isClosed && "font-bold text-ink",
                        )}
                      >
                        {row.isClosed || !row.opensAt || !row.closesAt
                          ? "Почивен ден"
                          : `${shortTime(row.opensAt)} – ${shortTime(row.closesAt)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div>
                <h3 className="text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
                  Почивки и изключения
                </h3>
                {exceptions.length === 0 ? (
                  <p className="mt-5 text-[0.92rem] leading-relaxed text-ink-soft">
                    В момента няма обявени промени в работното време.
                  </p>
                ) : (
                  <ul className="mt-4">
                    {exceptions.slice(0, 8).map((exception) => (
                      <li
                        key={exception.date}
                        className="border-b border-line py-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="numeral text-[0.92rem] font-semibold">
                            {formatDate(exception.date)}
                          </span>
                          <span className="numeral text-[0.88rem] text-ink-soft">
                            {exception.isClosed
                              ? "Затворено"
                              : `${shortTime(exception.opensAt)} – ${shortTime(exception.closesAt)}`}
                          </span>
                        </div>
                        {exception.note ? (
                          <p className="mt-1 text-[0.82rem] text-ink-faint">
                            {exception.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
