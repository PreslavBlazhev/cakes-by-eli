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
        <div className="mb-9 flex flex-wrap gap-2">
          <FilterChip active={filter === null} onClick={() => setFilter(null)}>
            Всички
          </FilterChip>
          {categories.map(([slug, name]) => (
            <FilterChip
              key={slug}
              active={filter === slug}
              onClick={() => setFilter(slug)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {visible.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              index % 7 === 0 ? "lg:row-span-2" : "",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group relative block w-full overflow-hidden rounded-[var(--radius-md)] bg-[#4b3730]"
              aria-label={`Отвори: ${item.caption || "снимка"}`}
            >
              <span
                className={cn(
                  "block",
                  index % 7 === 0 ? "aspect-[3/4]" : "aspect-[4/3]",
                )}
              >
                <Image
                  src={item.path}
                  alt={item.caption || ""}
                  fill
                  loading={index < 4 ? "eager" : "lazy"}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#180d0a]/70 via-transparent to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-90" />
              {item.caption ? (
                <span className="pointer-events-none absolute bottom-3 left-4 right-4 text-left font-[family-name:var(--font-display)] text-[1.02rem] leading-tight text-paper">
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
          className="fixed inset-0 z-[250] flex flex-col bg-cocoa-deep/94 backdrop-blur-sm"
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
          <div className="flex items-center justify-between gap-4 px-5 py-4 text-paper">
            <p className="font-[family-name:var(--font-display)] text-[1.1rem]">
              {active.caption}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Затвори прегледа"
              className="flex size-11 items-center justify-center rounded-full border border-paper/25 transition-colors hover:bg-paper hover:text-ink"
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
            <div className="flex items-center justify-center gap-4 px-5 py-5 text-paper">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Предишна снимка"
                className="flex size-12 items-center justify-center rounded-full border border-paper/25 transition-colors hover:bg-paper hover:text-ink"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <span className="text-[0.85rem] tabular-nums text-paper/70">
                {(openIndex ?? 0) + 1} / {visible.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Следваща снимка"
                className="flex size-12 items-center justify-center rounded-full border border-paper/25 transition-colors hover:bg-paper hover:text-ink"
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
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-4 text-[0.86rem] font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-paper hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}
