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

/**
 * The masthead of a printed menu rather than an app bar.
 *
 * The wordmark is set in the display face and given a hairline and a
 * letterspaced descriptor — a circular monogram badge is the generic
 * move, and this brand already has a name worth setting properly.
 */
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      className={cn(
        // Solid rather than translucent + backdrop blur: a blurred sticky bar
        // re-samples everything scrolling beneath it on every frame.
        "sticky top-0 z-50 bg-cream transition-[border-color] duration-300",
        scrolled ? "border-b border-line" : "border-b border-transparent",
      )}
    >
      <div className="wrap">
        <nav
          aria-label="Основна навигация"
          className="flex h-[72px] items-center justify-between gap-8 lg:h-[92px]"
        >
          <Link
            href="/"
            className="group min-w-max"
            aria-label={`${businessName} — начало`}
          >
            <span className="block font-[family-name:var(--font-display)] text-[1.32rem] leading-none tracking-[-0.015em] lg:text-[1.6rem]">
              {businessName}
            </span>
            <span className="mt-[7px] hidden items-center gap-2.5 sm:flex">
              <span
                aria-hidden="true"
                className="h-px w-6 bg-line-strong transition-[width] duration-500 group-hover:w-10"
              />
              <span className="text-[0.6rem] uppercase tracking-[0.28em] text-ink-faint">
                {tagline}
              </span>
            </span>
          </Link>

          {/* ------------------------------------------------- Desktop */}
          <div className="hidden items-center gap-9 lg:flex">
            <ul className="flex items-center gap-8">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    data-active={isActive(item.href)}
                    className={cn(
                      "link-underline py-1 text-[0.74rem] uppercase tracking-[0.2em] transition-colors",
                      isActive(item.href)
                        ? "font-bold text-rose-dark"
                        : "font-semibold text-ink-soft hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <span aria-hidden="true" className="h-6 w-px bg-line" />

            {phone ? (
              <a
                href={phoneHref}
                className="flex items-center gap-2 text-[0.86rem] font-semibold text-ink transition-colors hover:text-rose-dark"
              >
                <Phone size={14} aria-hidden="true" className="text-ink-faint" />
                {phone}
              </a>
            ) : null}

            <ButtonLink href="/order" variant="rose" size="sm">
              Поръчай
            </ButtonLink>
          </div>

          {/* ------------------------------------------ Mobile trigger */}
          <div className="flex items-center gap-3 lg:hidden">
            <ButtonLink href="/order" variant="rose" size="sm">
              Поръчай
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Затвори менюто" : "Отвори менюто"}
              className="flex size-11 flex-col items-center justify-center gap-[6px] rounded-[3px] border border-line bg-paper transition-colors hover:border-line-strong"
            >
              <span
                className={cn(
                  "block h-px w-[18px] bg-ink transition-transform duration-300",
                  open && "translate-y-[3.5px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-px w-[18px] bg-ink transition-transform duration-300",
                  open && "-translate-y-[3.5px] -rotate-45",
                )}
              />
            </button>
          </div>
        </nav>
      </div>

      {/* ------------------------------------------------ Mobile sheet */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-[72px] z-50 overflow-y-auto border-t border-line bg-cream lg:hidden"
      >
        <div className="wrap flex min-h-full flex-col py-10">
          <ul className="flex flex-col">
            {NAV.map((item, index) => (
              <li key={item.href} className="border-b border-line">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="flex items-baseline gap-4 py-5"
                >
                  <span
                    aria-hidden="true"
                    className="numeral w-7 flex-none text-[0.8rem] text-ink-faint"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "display-3",
                      isActive(item.href) ? "text-rose-dark" : "text-ink",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-4">
            <ButtonLink
              href="/order?mode=custom"
              variant="rose"
              size="lg"
              fullWidth
              onClick={() => setOpen(false)}
            >
              Създай свой десерт
            </ButtonLink>
            {phone ? (
              <a
                href={phoneHref}
                className="flex items-center justify-center gap-2.5 py-2 text-[1rem] font-semibold"
              >
                <Phone size={16} aria-hidden="true" className="text-ink-faint" />
                {phone}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
