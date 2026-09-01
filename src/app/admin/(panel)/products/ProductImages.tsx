"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, ImagePlus, Star, Trash2, X } from "lucide-react";

import { ConfirmAction, InlineAction } from "@/components/admin/ActionForm";
import { Card } from "@/components/admin/ui";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { LibraryImage } from "@/server/queries/gallery";
import { deleteProductImage, setProductCoverImage } from "@/server/admin/catalog";

type SavedImage = { id: string; path: string; alt: string };

/**
 * The picture side of the product form.
 *
 * Photos are shared across the site, so the owner has two ways in: upload a
 * new file, or reuse one that is already in the gallery or on another product.
 * Both work before the product exists — picks travel with the form and are
 * attached by the same Save — which is why they are held in state rather than
 * written straight away.
 *
 * Saved pictures are rows, so their controls (cover, remove) act at once.
 * Those buttons cannot be forms: this whole card sits inside the product form.
 */
export function ProductImages({
  images,
  library,
}: {
  images: SavedImage[];
  library: LibraryImage[];
}) {
  const [picked, setPicked] = useState<LibraryImage[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const attached = useMemo(
    () => new Set(images.map((image) => image.path)),
    [images],
  );
  const pickedPaths = useMemo(
    () => new Set(picked.map((image) => image.path)),
    [picked],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return library;
    return library.filter((image) => image.label.toLowerCase().includes(needle));
  }, [library, search]);

  const toggle = (image: LibraryImage) => {
    if (attached.has(image.path)) return;
    setPicked((current) =>
      current.some((entry) => entry.path === image.path)
        ? current.filter((entry) => entry.path !== image.path)
        : [...current, image],
    );
  };

  return (
    <Card
      title="Снимки"
      description="Първата снимка е основната — с нея продуктът се показва в менюто и на началната страница."
    >
      {images.length > 0 || picked.length > 0 ? (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-[var(--radius-sm)] border border-line"
            >
              <span className="relative block aspect-[4/3] bg-surface-sunk">
                <Image
                  src={image.path}
                  alt={image.alt}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-1.5 top-1.5">
                    <Badge tone="gold">Основна</Badge>
                  </span>
                ) : null}
                <span className="absolute right-1.5 top-1.5">
                  <ConfirmAction
                    action={deleteProductImage}
                    hiddenFields={{ imageId: image.id }}
                    label={<Trash2 size={13} aria-hidden="true" />}
                    title="Премахване на снимка"
                    message="Снимката се маха от този продукт. Ако се ползва и другаде в сайта, файлът остава."
                    confirmLabel="Премахни"
                    className="size-9 min-h-0 px-0"
                  />
                </span>
              </span>

              {index > 0 ? (
                <span className="flex justify-center border-t border-line bg-paper p-1.5">
                  <InlineAction
                    action={setProductCoverImage}
                    hiddenFields={{ imageId: image.id }}
                    label={
                      <>
                        <Star size={12} aria-hidden="true" />
                        Направи основна
                      </>
                    }
                  />
                </span>
              ) : null}
            </li>
          ))}

          {picked.map((image, index) => (
            <li
              key={image.path}
              className="overflow-hidden rounded-[var(--radius-sm)] border border-dashed border-gold"
            >
              <span className="relative block aspect-[4/3] bg-surface-sunk">
                <Image
                  src={image.path}
                  alt={image.label}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {images.length === 0 && index === 0 ? (
                  <span className="absolute left-1.5 top-1.5">
                    <Badge tone="gold">Основна</Badge>
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggle(image)}
                  aria-label="Откажи тази снимка"
                  className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-[3px] border border-line bg-paper/95 transition-colors hover:border-ink"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
              <span className="block border-t border-line bg-paper px-2 py-1.5 text-center text-[0.72rem] font-semibold text-ink-soft">
                добавя се при запазване
              </span>
              <input type="hidden" name="libraryPaths" value={image.path} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Качи нови снимки"
          hint="JPG, PNG или WEBP. Качват се при запазване."
          htmlFor="p-images"
        >
          <input
            id="p-images"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="block w-full text-[0.86rem] file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-paper file:px-4 file:py-2 file:text-[0.84rem] file:font-semibold hover:file:border-ink"
          />
        </Field>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={library.length === 0}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[3px] border border-line bg-paper px-4 text-[0.86rem] font-semibold transition-colors hover:border-ink disabled:opacity-60"
        >
          <ImagePlus size={15} aria-hidden="true" />
          Избери от галерията
        </button>
      </div>

      {library.length === 0 ? (
        <p className="mt-3 text-[0.82rem] text-ink-faint">
          Още няма снимки, от които да избирате. Качете ги от Админ → Галерия и
          ще се появят тук.
        </p>
      ) : null}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Снимки от сайта"
        description="Изберете снимка от галерията или от друг продукт. Файлът не се копира — една и съща снимка може да стои на няколко места."
        size="lg"
        footer={
          <>
            <span className="mr-auto self-center text-[0.84rem] text-ink-soft">
              {picked.length > 0
                ? "Избрани: " + picked.length
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
        <Field label="Търсене" htmlFor="p-library-search">
          <Input
            id="p-library-search"
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
              const isAttached = attached.has(image.path);
              const isPicked = pickedPaths.has(image.path);

              return (
                <li key={image.path}>
                  <button
                    type="button"
                    onClick={() => toggle(image)}
                    disabled={isAttached}
                    aria-pressed={isPicked}
                    className={cn(
                      "block w-full overflow-hidden rounded-[var(--radius-sm)] border text-left transition-colors",
                      isPicked
                        ? "border-gold ring-2 ring-gold/40"
                        : "border-line hover:border-ink",
                      isAttached && "opacity-60",
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
                        {isAttached
                          ? "вече е при този продукт"
                          : image.source === "gallery"
                            ? "от галерията"
                            : "от друг продукт"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </Card>
  );
}
