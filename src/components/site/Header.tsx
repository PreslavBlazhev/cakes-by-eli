"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Начало" },
  { href: "/menu", label: "Меню" },
  { href: "/gallery", label: "Галерия" },
  { href: "/contacts", label: "Контакти" },
];

export function Header({
  businessName,
  tagline,
  phone,
  phoneHref,
}: {
  businessName: string;
  tagline: string;
  phone: string;
  phoneHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      data-site-header
      className="sticky top-0 z-50 border-b border-line/80 bg-cream/90 backdrop-blur-xl"
    >
      <div className="wrap">
        <nav
          aria-label="Основна навигация"
          className="flex h-[74px] items-center justify-between gap-6 lg:h-[86px]"
        >
          <Link
            href="/"
            className="flex min-w-max items-center gap-3"
            aria-label={`${businessName} — начало`}
          >
            <span
              aria-hidden="true"
              className="relative grid size-10 place-items-center rounded-full bg-ink text-paper lg:size-[46px]"
            >
              <span className="absolute inset-1 rounded-full border border-paper/45" />
              <span className="font-[family-name:var(--font-display)] text-[1.1rem] italic lg:text-[1.25rem]">
                CE
              </span>
            </span>
            <span>
              <span className="block font-[family-name:var(--font-display)] text-[1.2rem] leading-none tracking-[-0.03em] lg:text-[1.42rem]">
                {businessName}
              </span>
              <span className="mt-1 hidden text-[0.66rem] uppercase tracking-[0.17em] text-ink-soft sm:block">
                {tagline}
              </span>
            </span>
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-7 lg:flex">
            <ul className="flex items-center gap-7 text-[0.93rem]">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "group relative inline-block py-1",
                      isActive(item.href) && "font-bold text-rose-dark",
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -bottom-0.5 left-0 h-px bg-rose-dark transition-all duration-300",
                        isActive(item.href)
                          ? "right-0"
                          : "right-full group-hover:right-0",
                      )}
                    />
                  </Link>
                </li>
              ))}
            </ul>
            {phone ? (
              <a
                href={phoneHref}
                className="flex items-center gap-2 text-[0.9rem] font-semibold text-ink-soft transition-colors hover:text-ink"
              >
                <Phone size={15} aria-hidden="true" />
                {phone}
              </a>
            ) : null}
            <ButtonLink href="/order" variant="rose" size="sm">
              Поръчай
            </ButtonLink>
          </div>

          {/* Mobile trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <ButtonLink href="/order" variant="rose" size="sm">
              Поръчай
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Затвори менюто" : "Отвори менюто"}
              className="flex size-11 flex-col items-center justify-center gap-[5px] rounded-full transition-colors hover:bg-blush-soft"
            >
              <span
                className={cn(
                  "block h-px w-[22px] bg-ink transition-transform duration-300",
                  open && "translate-y-[6px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-px w-[22px] bg-ink transition-opacity duration-200",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-px w-[22px] bg-ink transition-transform duration-300",
                  open && "-translate-y-[6px] -rotate-45",
                )}
              />
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile sheet */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="lg:hidden"
      >
        <div className="wrap pb-5">
          <ul className="panel flex flex-col gap-1 p-3 shadow-[var(--shadow-card)]">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-[var(--radius-sm)] px-4 py-3.5 text-[1rem] transition-colors",
                    isActive(item.href)
                      ? "bg-blush-soft font-bold text-rose-dark"
                      : "hover:bg-surface-sunk",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {phone ? (
              <li className="mt-1 border-t border-line pt-2">
                <a
                  href={phoneHref}
                  className="flex items-center gap-2 rounded-[var(--radius-sm)] px-4 py-3.5 font-semibold"
                >
                  <Phone size={16} aria-hidden="true" />
                  {phone}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </header>
  );
}
