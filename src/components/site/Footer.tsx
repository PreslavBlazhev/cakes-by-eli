import Link from "next/link";

import { SocialLinks } from "@/components/site/SocialLinks";
import { shortTime } from "@/lib/format";
import { WEEKDAY_SHORT } from "@/lib/labels";
import type { WorkingHourRow } from "@/lib/schedule";
import type { SiteSettings } from "@/server/queries/settings";

/** Groups consecutive identical days into "Пон – Пет 09:00 – 18:00". */
function summariseHours(hours: WorkingHourRow[]): string[] {
  const sorted = [...hours].sort((a, b) => a.weekday - b.weekday);
  const out: string[] = [];

  let runStart: WorkingHourRow | null = null;
  let runEnd: WorkingHourRow | null = null;

  const describe = (row: WorkingHourRow) =>
    row.isClosed || !row.opensAt || !row.closesAt
      ? "Почивен ден"
      : `${shortTime(row.opensAt)} – ${shortTime(row.closesAt)}`;

  const flush = () => {
    if (!runStart || !runEnd) return;
    const label =
      runStart.weekday === runEnd.weekday
        ? WEEKDAY_SHORT[runStart.weekday]
        : `${WEEKDAY_SHORT[runStart.weekday]} – ${WEEKDAY_SHORT[runEnd.weekday]}`;
    out.push(`${label}  ${describe(runStart)}`);
  };

  for (const row of sorted) {
    if (runStart && runEnd && describe(row) === describe(runEnd)) {
      runEnd = row;
      continue;
    }
    flush();
    runStart = row;
    runEnd = row;
  }
  flush();

  return out;
}

export function Footer({
  settings,
  hours,
}: {
  settings: SiteSettings;
  hours: WorkingHourRow[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      data-site-footer
      className="border-t border-line bg-paper pt-14 pb-10"
    >
      <div className="wrap">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-[1.5rem] leading-none tracking-[-0.03em]">
              {settings.businessName}
            </p>
            <p className="mt-2 text-[0.7rem] uppercase tracking-[0.17em] text-ink-soft">
              {settings.tagline}
            </p>
            <SocialLinks
              facebookUrl={settings.facebookUrl}
              instagramUrl={settings.instagramUrl}
              className="mt-5"
            />
          </div>

          <nav aria-label="Долна навигация">
            <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
              Навигация
            </p>
            <ul className="mt-3 space-y-2 text-[0.92rem]">
              <li>
                <Link href="/" className="transition-colors hover:text-rose-dark">
                  Начало
                </Link>
              </li>
              <li>
                <Link href="/menu" className="transition-colors hover:text-rose-dark">
                  Меню
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="transition-colors hover:text-rose-dark">
                  Галерия
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="transition-colors hover:text-rose-dark">
                  Контакти
                </Link>
              </li>
              <li>
                <Link href="/order" className="font-semibold text-rose-dark">
                  Поръчай
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
              Контакти
            </p>
            <ul className="mt-3 space-y-2 text-[0.92rem] text-ink-soft">
              {settings.phone ? (
                <li>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, "")}`}
                    className="font-semibold text-ink transition-colors hover:text-rose-dark"
                  >
                    {settings.phone}
                  </a>
                </li>
              ) : null}
              {settings.email ? (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="transition-colors hover:text-rose-dark"
                  >
                    {settings.email}
                  </a>
                </li>
              ) : null}
              {settings.addressLine ? (
                <li>
                  {settings.addressLine}
                  <br />
                  {settings.city}
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <p className="text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
              Работно време
            </p>
            <ul className="mt-3 space-y-1.5 text-[0.9rem] text-ink-soft">
              {summariseHours(hours).map((line) => (
                <li key={line} className="whitespace-pre">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[0.82rem] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.businessName}. Всички права запазени.
          </p>
          <Link
            href="/privacy"
            className="transition-colors hover:text-rose-dark"
          >
            Политика за поверителност
          </Link>
        </div>
      </div>
    </footer>
  );
}
