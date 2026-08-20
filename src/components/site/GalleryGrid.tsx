"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/cn";

export type GalleryEntry = {
  id: string;
  path: string;
  caption: string;
  categoryName: string | null;
  categorySlug: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Masonry-ish gallery with a keyboard-navigable lightbox and touch swiping.
 * Filtering only appears when there is genuinely more than one category, so it
 * never becomes decorative clutter.
 */
export function GalleryGrid({ items }: { items: GalleryEntry[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.categorySlug && item.categoryName) {
        map.set(item.categorySlug, item.categoryName);
      }
    }
    return [...map.entries()];
  }, [items]);

  const visible = useMemo(
    () => (filter ? items.filter((i) => i.categorySlug === filter) : items),
    [items, filter],
  );

  const close = useCallback(() => setOpenIndex(null), []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        const next = current + delta;
        if (next < 0) return visible.length - 1;
        if (next >= visible.length) return 0;
        return next;
      });
    },
    [visible.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "Tab") {
        // Only the close button is focusable inside the lightbox.
        event.preventDefault();
        closeRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [openIndex, close, step]);

  const active = openIndex === null ? null : visible[openIndex];

  return (
    <>
      {categories.length > 1 ? (
        <nav aria-label="Филтър по категория" className="mb-12">
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3 border-y border-line py-4">
            <li>
              <FilterChip
                active={filter === null}
                onClick={() => setFilter(null)}
              >
                Всички
              </FilterChip>
            </li>
            {categories.map(([slug, name]) => (
              <li key={slug}>
                <FilterChip
                  active={filter === slug}
                  onClick={() => setFilter(slug)}
                >
                  {name}
                </FilterChip>
              </li>
            ))}
            <li className="ml-auto text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
              <span className="numeral me-1 text-ink">{visible.length}</span> снимки
            </li>
          </ul>
        </nav>
      ) : null}

      {/* True masonry. A fixed-ratio grid crops every photograph to the
          same rectangle, which is exactly what makes a pastry portfolio
          look like a stock-photo wall; columns let each image keep the
          proportions it was shot in. */}
      <ul className="columns-2 gap-4 lg:columns-3 lg:gap-5 [&>li]:mb-4 lg:[&>li]:mb-5">
        {visible.map((item, index) => (
          <li key={item.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="frame group relative block w-full bg-surface-sunk"
              aria-label={`Отвори: ${item.caption || "снимка"}`}
            >
              <span
                className="block"
                style={{
                  aspectRatio:
                    item.width && item.height
                      ? `${item.width} / ${item.height}`
                      : "4 / 5",
                }}
              >
                <Image
                  src={item.path}
                  alt={item.caption || ""}
                  fill
                  loading={index < 6 ? "eager" : "lazy"}
                  sizes="(max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.05]"
                />
              </span>

              {/* Caption stays out of the way until asked for. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-cocoa-deep/75 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              {item.caption ? (
                <span className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-2 text-left font-[family-name:var(--font-display)] text-[1rem] leading-snug text-paper opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  {item.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption || "Преглед на снимка"}
          className="fixed inset-0 z-[250] flex flex-col bg-cocoa-deep/97"
          onTouchStart={(e) => {
            touchStart.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            const end = e.changedTouches[0]?.clientX;
            if (start === null || end === undefined) return;
            const delta = end - start;
            if (Math.abs(delta) > 55) step(delta < 0 ? 1 : -1);
            touchStart.current = null;
          }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-paper/10 px-5 py-4 text-paper sm:px-8">
            <p className="font-[family-name:var(--font-display)] text-[1.05rem] italic">
              {active.caption}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Затвори прегледа"
              className="flex size-11 items-center justify-center rounded-[3px] border border-paper/25 transition-colors hover:border-paper hover:bg-paper hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex-1" onClick={close}>
            <Image
              src={active.path}
              alt={active.caption || ""}
              fill
              sizes="100vw"
              className="object-contain p-4"
            />
          </div>

          {visible.length > 1 ? (
            <div className="flex items-center justify-center gap-6 border-t border-paper/10 px-5 py-5 text-paper">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Предишна снимка"
                className="flex size-12 items-center justify-center rounded-[3px] border border-paper/25 transition-colors hover:bg-paper hover:text-ink"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <span className="numeral text-[0.8rem] tracking-[0.14em] text-paper/60">
                {(openIndex ?? 0) + 1} / {visible.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Следваща снимка"
                className="flex size-12 items-center justify-center rounded-[3px] border border-paper/25 transition-colors hover:bg-paper hover:text-ink"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-active={active}
      className={cn(
        "link-underline inline-flex min-h-9 items-center text-[0.74rem] uppercase tracking-[0.16em] transition-colors",
        active
          ? "font-bold text-rose-dark"
          : "font-semibold text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
