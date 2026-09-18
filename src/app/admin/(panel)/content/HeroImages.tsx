"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, X } from "lucide-react";

import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { HERO_IMAGE_SLOTS } from "@/lib/hero-images";
import type { LibraryImage } from "@/server/queries/gallery";

/** What each position is on the page, so the choice is not made blind. */
const SLOT_LABELS = [
  "Голямата снимка",
  "Малката долу вляво",
  "Малката горе вляво",
];

/**
 * The three photographs of the first screen.
 *
 * They used to be taken automatically from the products marked „Избрано“, so
 * the same cake led the page and then appeared again just below it. Here the
 * owner pins them herself; leaving the choice empty restores the automatic
 * behaviour. Picks live in state and travel with the form's Save, exactly as
 * in the product form — this card sits inside the big content form and cannot
 * submit on its own.
 */
export function HeroImages({
  chosen,
  library,
}: {
  chosen: string[];
  library: LibraryImage[];
}) {
  const [picked, setPicked] = useState<string[]>(() =>
    chosen.slice(0, HERO_IMAGE_SLOTS),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const byPath = useMemo(
    () => new Map(library.map((image) => [image.path, image])),
    [library],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return library;
    return library.filter((image) => image.label.toLowerCase().includes(needle));
  }, [library, search]);

  const toggle = (path: string) => {
    setPicked((current) => {
      if (current.includes(path)) return current.filter((p) => p !== path);
      if (current.length >= HERO_IMAGE_SLOTS) return current;
      return [...current, path];
    });
  };

  const move = (index: number, delta: number) => {
    setPicked((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const full = picked.length >= HERO_IMAGE_SLOTS;

  return (
    <div className="sm:col-span-2">
      <p className="text-[0.82rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
        Снимки на първия екран
      </p>
      <p className="mt-1.5 text-[0.84rem] text-ink-soft">
        До три снимки, в реда отдясно на заглавието. Ако не изберете нито една,
        сайтът показва снимките на продуктите, отбелязани като „Избрано“ — и
        тогава те се виждат два пъти на страницата. Нови снимки се качват от
        Админ → Галерия и веднага се появяват тук.
      </p>

      {picked.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {picked.map((path, index) => (
            <li
              key={path}
              className="overflow-hidden rounded-[var(--radius-sm)] border border-line"
            >
              <span className="relative block aspect-[4/3] bg-surface-sunk">
                <Image
                  src={path}
                  alt={byPath.get(path)?.label ?? ""}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => toggle(path)}
                  aria-label="Махни тази снимка"
                  className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-[3px] border border-line bg-paper/95 transition-colors hover:border-ink"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>

              <span className="flex items-center justify-between gap-2 border-t border-line bg-paper px-2 py-1.5">
                <span className="line-clamp-1 text-[0.74rem] font-semibold text-ink-soft">
                  {SLOT_LABELS[index]}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Премести наляво"
                    className="flex size-8 items-center justify-center rounded-[3px] border border-line transition-colors hover:border-ink disabled:opacity-40"
                  >
                    <ArrowLeft size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === picked.length - 1}
                    aria-label="Премести надясно"
                    className="flex size-8 items-center justify-center rounded-[3px] border border-line transition-colors hover:border-ink disabled:opacity-40"
                  >
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </span>
              </span>

              <input type="hidden" name="heroImages" value={path} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={library.length === 0 || full}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[3px] border border-line bg-paper px-4 text-[0.86rem] font-semibold transition-colors hover:border-ink disabled:opacity-60"
        >
          <ImagePlus size={15} aria-hidden="true" />
          Избери снимки
        </button>
        {picked.length > 0 ? (
          <button
            type="button"
            onClick={() => setPicked([])}
            className="text-[0.82rem] font-semibold text-ink-soft underline-offset-2 hover:underline"
          >
            Изчисти избора
          </button>
        ) : null}
        <span className="text-[0.82rem] text-ink-faint">
          {full
            ? "Трите места са заети."
            : `Избрани: ${picked.length} от ${HERO_IMAGE_SLOTS}.`}
        </span>
      </div>

      {library.length === 0 ? (
        <p className="mt-3 text-[0.82rem] text-ink-faint">
          Още няма снимки, от които да избирате. Качете ги от Админ → Галерия.
        </p>
      ) : null}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Снимки от сайта"
        description="Изберете до три снимки за първия екран. Файлът не се копира — същата снимка може да стои и на продукт, и в галерията."
        size="lg"
        footer={
          <>
            <span className="mr-auto self-center text-[0.84rem] text-ink-soft">
              {picked.length > 0
                ? `Избрани: ${picked.length} от ${HERO_IMAGE_SLOTS}`
                : "Още нищо не е избрано."}
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="inline-flex min-h-10 items-center rounded-[3px] bg-ink px-4 text-[0.86rem] font-semibold text-paper transition-colors hover:bg-cocoa"
            >
              Готово
            </button>
          </>
        }
      >
        <Field label="Търсене" htmlFor="hero-library-search">
          <Input
            id="hero-library-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Име на продукт или описание"
          />
        </Field>

        {visible.length === 0 ? (
          <p className="mt-5 text-[0.88rem] text-ink-soft">
            Няма снимка с такова описание.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((image) => {
              const isPicked = picked.includes(image.path);
              const slot = picked.indexOf(image.path);

              return (
                <li key={image.path}>
                  <button
                    type="button"
                    onClick={() => toggle(image.path)}
                    disabled={!isPicked && full}
                    aria-pressed={isPicked}
                    className={cn(
                      "block w-full overflow-hidden rounded-[var(--radius-sm)] border text-left transition-colors",
                      isPicked
                        ? "border-gold ring-2 ring-gold/40"
                        : "border-line hover:border-ink",
                      !isPicked && full && "opacity-60",
                    )}
                  >
                    <span className="relative block aspect-[4/3] bg-surface-sunk">
                      <Image
                        src={image.path}
                        alt={image.label}
                        fill
                        sizes="240px"
                        className="object-cover"
                      />
                      {isPicked ? (
                        <span className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-ink text-paper">
                          <Check size={14} aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                    <span className="block px-2.5 py-2">
                      <span className="line-clamp-1 block text-[0.8rem] font-semibold">
                        {image.label}
                      </span>
                      <span className="mt-0.5 block text-[0.72rem] text-ink-faint">
                        {isPicked
                          ? SLOT_LABELS[slot]
                          : image.source === "gallery"
                            ? "от галерията"
                            : "от продукт"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}
