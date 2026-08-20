"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { AVAILABLE_RENDERERS } from "@/features/configurator/preview/DessertPreview";
import { saveDessertType } from "@/server/admin/customizations";

const RENDERER_LABELS: Record<string, string> = {
  cake: "Торта / чийзкейк (етажи, покритие, декорация)",
  eclair: "Еклери (табла с еклери)",
  cupcake: "Къпкейкове",
  macaron: "Макарони",
  cookie: "Декорирани бисквити",
  cakepop: "Кейк попс",
  generic: "Универсална кутия с десерти",
};

export function DessertTypeDialog({
  categories,
  existing,
}: {
  categories: { id: string; name: string }[];
  existing?: {
    id: string;
    name: string;
    renderer: string;
    description: string;
    categoryId: string | null;
    basePriceCents: number | null;
    sortOrder: number;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-[3px] bg-ink px-4 text-[0.86rem] font-semibold text-paper transition-colors hover:bg-cocoa"
      >
        {existing ? (
          "Редактирай вида"
        ) : (
          <>
            <Plus size={15} aria-hidden="true" />
            Нов вид десерт
          </>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={existing ? "Редактиране на вид десерт" : "Нов вид десерт"}
        description="Видът десерт събира въпросите, които клиентът вижда в конфигуратора."
      >
        <ActionForm
          action={saveDessertType}
          className="space-y-4"
          onSuccess={(result) => {
            setOpen(false);
            if (!existing && result.ok && result.id) {
              router.push(`/admin/customizations/${result.id}`);
            }
          }}
        >
          {({ pending, fieldErrors }) => (
            <>
              {existing ? (
                <input type="hidden" name="id" value={existing.id} />
              ) : null}

              <Field
                label="Име"
                required
                error={fieldErrors.name}
                htmlFor="dt-name"
              >
                <Input
                  id="dt-name"
                  name="name"
                  defaultValue={existing?.name ?? ""}
                  required
                  maxLength={80}
                />
              </Field>

              <Field
                label="Визуализация"
                hint="Определя как изглежда живият преглед."
                htmlFor="dt-renderer"
              >
                <Select
                  id="dt-renderer"
                  name="renderer"
                  defaultValue={existing?.renderer ?? "generic"}
                >
                  {AVAILABLE_RENDERERS.map((renderer) => (
                    <option key={renderer} value={renderer}>
                      {RENDERER_LABELS[renderer] ?? renderer}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Описание" htmlFor="dt-desc">
                <Textarea
                  id="dt-desc"
                  name="description"
                  defaultValue={existing?.description ?? ""}
                  maxLength={400}
                  className="min-h-20"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Категория" htmlFor="dt-category">
                  <Select
                    id="dt-category"
                    name="categoryId"
                    defaultValue={existing?.categoryId ?? ""}
                  >
                    <option value="">— без —</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Базова цена (EUR)"
                  hint="Празно = без изчисление."
                  htmlFor="dt-price"
                >
                  <Input
                    id="dt-price"
                    name="basePrice"
                    inputMode="decimal"
                    defaultValue={
                      existing?.basePriceCents == null
                        ? ""
                        : (existing.basePriceCents / 100).toFixed(2)
                    }
                  />
                </Field>

                <Field label="Ред" htmlFor="dt-order">
                  <Input
                    id="dt-order"
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={existing?.sortOrder ?? 0}
                  />
                </Field>
              </div>

              <Checkbox
                name="isActive"
                defaultChecked={existing ? existing.isActive : true}
                label="Предлагай в конфигуратора"
              />

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-10 items-center rounded-[3px] border border-line px-4 text-[0.86rem] font-semibold transition-colors hover:bg-surface-sunk"
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
