"use client";

import Image from "next/image";
import { useState } from "react";
import { Upload } from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  QuickAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { AdminEmpty, Card, DemoNotice } from "@/components/admin/ui";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import {
  archiveGalleryItem,
  deleteGalleryItem,
  restoreGalleryItem,
  updateGalleryItem,
  uploadGalleryImages,
} from "@/server/admin/site";

type Item = {
  id: string;
  path: string;
  caption: string;
  categoryId: string | null;
  sortOrder: number;
  isFeatured: boolean;
  isDemo: boolean;
  archived: boolean;
};

export function GalleryManager({
  items,
  categories,
}: {
  items: Item[];
  categories: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<Item | null>(null);
  const demoCount = items.filter((item) => item.isDemo).length;

  return (
    <>
      {demoCount > 0 ? (
        <DemoNotice>
          {demoCount} от изображенията са примерни илюстрации от инсталацията.
          Заменете ги с реални снимки на вашите десерти.
        </DemoNotice>
      ) : null}

      <Card title="Качване на снимки" className="mb-4">
        <ActionForm
          action={uploadGalleryImages}
          resetOnSuccess
          className="grid gap-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end"
        >
          {({ pending }) => (
            <>
              <Field
                label="Снимки"
                hint="JPG, PNG или WEBP. Може да изберете няколко наведнъж."
                htmlFor="g-files"
              >
                <input
                  id="g-files"
                  name="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  required
                  className="block w-full text-[0.86rem] file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-paper file:px-4 file:py-2 file:text-[0.84rem] file:font-semibold hover:file:border-ink"
                />
              </Field>

              <Field label="Категория" htmlFor="g-category">
                <Select id="g-category" name="categoryId">
                  <option value="">— без категория —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <SubmitButton pending={pending}>
                <Upload size={15} aria-hidden="true" />
                Качи
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>

      <Card title={`Снимки (${items.length})`} padded={false}>
        {items.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title="Няма качени снимки."
              description="Галерията в сайта показва съобщение, докато няма съдържание."
            />
          </div>
        ) : (
          <ul className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-[var(--radius-sm)] border border-line"
              >
                <span className="relative block aspect-[4/3] bg-surface-sunk">
                  <Image
                    src={item.path}
                    alt={item.caption}
                    fill
                    sizes="240px"
                    className="object-cover"
                  />
                  {item.archived ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-cocoa/60">
                      <Badge tone="muted">Скрита</Badge>
                    </span>
                  ) : null}
                </span>

                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 min-h-[2.2em] text-[0.82rem]">
                    {item.caption || (
                      <span className="text-ink-faint">без описание</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.isFeatured ? <Badge tone="gold">Избрана</Badge> : null}
                    {item.isDemo ? <Badge tone="warning">Демо</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="inline-flex min-h-9 items-center rounded-[3px] border border-line bg-paper px-3 text-[0.78rem] font-semibold transition-colors hover:border-ink"
                    >
                      Редактирай
                    </button>
                    {item.archived ? (
                      <QuickAction
                        action={restoreGalleryItem}
                        hiddenFields={{ id: item.id }}
                        label="Върни"
                      />
                    ) : (
                      <QuickAction
                        action={archiveGalleryItem}
                        hiddenFields={{ id: item.id }}
                        label="Скрий"
                      />
                    )}
                    <ConfirmAction
                      action={deleteGalleryItem}
                      hiddenFields={{ id: item.id }}
                      label="Изтрий"
                      title="Изтриване на снимка"
                      message="Снимката ще бъде изтрита окончателно, включително файлът."
                      confirmLabel="Изтрий"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Редактиране на снимка"
      >
        {editing ? (
          <ActionForm
            action={updateGalleryItem}
            onSuccess={() => setEditing(null)}
            className="space-y-4"
          >
            {({ pending }) => (
              <>
                <input type="hidden" name="id" value={editing.id} />

                <Field label="Описание" htmlFor="gi-caption">
                  <Input
                    id="gi-caption"
                    name="caption"
                    defaultValue={editing.caption}
                    maxLength={200}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Категория" htmlFor="gi-category">
                    <Select
                      id="gi-category"
                      name="categoryId"
                      defaultValue={editing.categoryId ?? ""}
                    >
                      <option value="">— без категория —</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Ред на показване" htmlFor="gi-order">
                    <Input
                      id="gi-order"
                      name="sortOrder"
                      type="number"
                      min={0}
                      defaultValue={editing.sortOrder}
                    />
                  </Field>
                </div>

                <Checkbox
                  name="isFeatured"
                  defaultChecked={editing.isFeatured}
                  label="Показвай на началната страница"
                />

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="inline-flex min-h-10 items-center rounded-[3px] border border-line px-4 text-[0.86rem] font-semibold transition-colors hover:bg-surface-sunk"
                  >
                    Отказ
                  </button>
                  <SubmitButton pending={pending}>Запази</SubmitButton>
                </div>
              </>
            )}
          </ActionForm>
        ) : null}
      </Modal>
    </>
  );
}
