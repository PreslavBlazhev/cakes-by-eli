"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  QuickAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { AdminEmpty } from "@/components/admin/ui";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import {
  clearCategoryImage,
  deleteCategory,
  reorderCategory,
  saveCategory,
} from "@/server/admin/catalog";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  accent: string;
  sortOrder: number;
  isVisible: boolean;
  productCount: number;
  imagePath: string | null;
};

const ACCENTS = [
  ["rose", "Розово"],
  ["chocolate", "Шоколадово"],
  ["gold", "Златисто"],
  ["sage", "Зелено"],
  ["blush", "Пудра"],
] as const;

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <p className="text-[0.86rem] text-ink-soft">
          {categories.length} категории
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.86rem] font-semibold text-paper transition-colors hover:bg-cocoa"
        >
          <Plus size={15} aria-hidden="true" />
          Добави категория
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="p-5">
          <AdminEmpty
            title="Няма категории."
            description="Добавете първата категория, за да подредите менюто."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {categories.map((category, index) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center gap-3 px-5 py-4"
            >
              <span className="relative size-12 flex-none overflow-hidden rounded-[var(--radius-xs)] border border-line bg-surface-sunk">
                {category.imagePath ? (
                  <Image
                    src={category.imagePath}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : null}
              </span>
              <div className="flex flex-col gap-0.5">
                <QuickAction
                  action={reorderCategory}
                  hiddenFields={{ id: category.id, direction: "up" }}
                  label={<ChevronUp size={13} aria-hidden="true" />}
                  className="size-7 min-h-0 px-0"
                />
                <QuickAction
                  action={reorderCategory}
                  hiddenFields={{ id: category.id, direction: "down" }}
                  label={<ChevronDown size={13} aria-hidden="true" />}
                  className="size-7 min-h-0 px-0"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{category.name}</p>
                  {category.isVisible ? null : (
                    <Badge tone="muted">Скрита</Badge>
                  )}
                  <Badge tone="neutral">{category.productCount} продукта</Badge>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[0.82rem] text-ink-soft">
                  /menu/{category.slug}
                  {category.description ? ` · ${category.description}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(category)}
                  className="inline-flex min-h-9 items-center rounded-full border border-line bg-paper px-3.5 text-[0.82rem] font-semibold transition-colors hover:border-ink"
                >
                  Редактирай
                </button>
                <ConfirmAction
                  action={deleteCategory}
                  hiddenFields={{ id: category.id }}
                  label="Изтрий"
                  title="Изтриване на категория"
                  message={`Категорията „${category.name}“ ще бъде премахната. Това е възможно само ако в нея няма продукти.`}
                  confirmLabel="Изтрий"
                />
              </div>

              <span className="sr-only">Позиция {index + 1}</span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={close}
        title={editing ? "Редактиране на категория" : "Нова категория"}
      >
        <ActionForm action={saveCategory} onSuccess={close} className="space-y-4">
          {({ pending, fieldErrors }) => (
            <>
              {editing ? (
                <input type="hidden" name="id" value={editing.id} />
              ) : null}

              <Field
                label="Име"
                required
                error={fieldErrors.name}
                htmlFor="cat-name"
              >
                <Input
                  id="cat-name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  required
                  maxLength={80}
                />
              </Field>

              <Field
                label="Адрес в сайта (slug)"
                hint="Оставете празно, за да се генерира автоматично от името."
                error={fieldErrors.slug}
                htmlFor="cat-slug"
              >
                <Input
                  id="cat-slug"
                  name="slug"
                  defaultValue={editing?.slug ?? ""}
                  maxLength={64}
                  placeholder="torti"
                />
              </Field>

              <Field label="Описание" htmlFor="cat-desc">
                <Textarea
                  id="cat-desc"
                  name="description"
                  defaultValue={editing?.description ?? ""}
                  maxLength={600}
                  className="min-h-24"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Цветови акцент" htmlFor="cat-accent">
                  <Select
                    id="cat-accent"
                    name="accent"
                    defaultValue={editing?.accent ?? "rose"}
                  >
                    {ACCENTS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Ред на показване" htmlFor="cat-order">
                  <Input
                    id="cat-order"
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={editing?.sortOrder ?? 0}
                  />
                </Field>
              </div>

              <Field
                label="Снимка на категорията"
                hint="JPG, PNG или WEBP. Заменя текущата при запазване."
                htmlFor="cat-image"
              >
                <input
                  id="cat-image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full text-[0.86rem] file:mr-3 file:rounded-full file:border file:border-line file:bg-paper file:px-4 file:py-2 file:text-[0.84rem] file:font-semibold hover:file:border-ink"
                />
              </Field>

              {editing?.imagePath ? (
                <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-surface-sunk/60 p-3">
                  <span className="relative size-16 flex-none overflow-hidden rounded-[var(--radius-xs)] border border-line bg-paper">
                    <Image
                      src={editing.imagePath}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </span>
                  <p className="flex-1 text-[0.8rem] text-ink-soft">
                    Текуща снимка на категорията.
                  </p>
                  <ConfirmAction
                    action={clearCategoryImage}
                    hiddenFields={{ id: editing.id }}
                    label="Премахни"
                    title="Премахване на снимката"
                    message="Категорията ще се показва с цветна плочка вместо снимка."
                    confirmLabel="Премахни"
                    variant="secondary"
                  />
                </div>
              ) : null}

              <Checkbox
                name="isVisible"
                defaultChecked={editing ? editing.isVisible : true}
                label="Показвай в сайта"
                description="Скритите категории не се виждат в менюто."
              />

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[0.86rem] font-semibold transition-colors hover:bg-surface-sunk"
                >
                  Отказ
                </button>
                <SubmitButton pending={pending}>Запази</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      </Modal>
    </>
  );
}
