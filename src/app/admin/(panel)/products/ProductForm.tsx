"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { Card } from "@/components/admin/ui";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ALLERGEN_OPTIONS, AVAILABILITY_LABELS } from "@/lib/labels";
import { deleteProductImage, saveProduct } from "@/server/admin/catalog";

export type ProductFormValues = {
  id?: string;
  categoryId: string;
  dessertTypeId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: string;
  portions: string;
  weightGrams: string;
  availability: keyof typeof AVAILABILITY_LABELS;
  isFeatured: boolean;
  isCustomizable: boolean;
  ingredients: string;
  allergens: string[];
  allergenNote: string;
  shippingAllowed: boolean;
  pickupAllowed: boolean;
  shipWeightKg: string;
  shipLengthCm: string;
  shipWidthCm: string;
  shipHeightCm: string;
  packageCount: string;
  sortOrder: string;
};

/**
 * One screen for everything about a product. The owner is not technical, so
 * the fields are grouped the way they would describe the product out loud,
 * and images upload with the same Save.
 */
export function ProductForm({
  values,
  categories,
  dessertTypes,
  images,
}: {
  values: ProductFormValues;
  categories: { id: string; name: string }[];
  dessertTypes: { id: string; name: string }[];
  images: { id: string; path: string; alt: string }[];
}) {
  const router = useRouter();
  const [shippingAllowed, setShippingAllowed] = useState(values.shippingAllowed);

  return (
    <ActionForm
      action={saveProduct}
      className="space-y-4"
      onSuccess={(result) => {
        if (!values.id && result.ok && result.id) {
          router.push(`/admin/products/${result.id}`);
        }
      }}
    >
      {({ pending, fieldErrors }) => (
        <>
          {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

          <Card title="Основно">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Име"
                required
                error={fieldErrors.name}
                htmlFor="p-name"
                className="sm:col-span-2"
              >
                <Input
                  id="p-name"
                  name="name"
                  defaultValue={values.name}
                  required
                  maxLength={120}
                />
              </Field>

              <Field
                label="Категория"
                required
                error={fieldErrors.categoryId}
                htmlFor="p-category"
              >
                <Select
                  id="p-category"
                  name="categoryId"
                  defaultValue={values.categoryId}
                  required
                >
                  <option value="">— изберете —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Свързан вид десерт"
                hint="Позволява бутона „Персонализирай“ да отвори конфигуратора."
                htmlFor="p-dessert"
              >
                <Select
                  id="p-dessert"
                  name="dessertTypeId"
                  defaultValue={values.dessertTypeId}
                >
                  <option value="">— без —</option>
                  {dessertTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Кратко описание"
                hint="Показва се в списъците."
                htmlFor="p-short"
                className="sm:col-span-2"
              >
                <Input
                  id="p-short"
                  name="shortDescription"
                  defaultValue={values.shortDescription}
                  maxLength={300}
                />
              </Field>

              <Field
                label="Пълно описание"
                htmlFor="p-desc"
                className="sm:col-span-2"
              >
                <Textarea
                  id="p-desc"
                  name="description"
                  defaultValue={values.description}
                  maxLength={4000}
                  className="min-h-32"
                />
              </Field>

              <Field
                label="Цена (EUR)"
                hint="Оставете празно за „Цена след уточнение“."
                htmlFor="p-price"
              >
                <Input
                  id="p-price"
                  name="price"
                  defaultValue={values.price}
                  inputMode="decimal"
                  placeholder="напр. 45.00"
                />
              </Field>

              <Field label="Порции" htmlFor="p-portions">
                <Input
                  id="p-portions"
                  name="portions"
                  defaultValue={values.portions}
                  maxLength={60}
                  placeholder="напр. 16 – 20 порции"
                />
              </Field>

              <Field label="Тегло (грама)" htmlFor="p-weight">
                <Input
                  id="p-weight"
                  name="weightGrams"
                  type="number"
                  min={1}
                  defaultValue={values.weightGrams}
                />
              </Field>

              <Field label="Наличност" htmlFor="p-availability">
                <Select
                  id="p-availability"
                  name="availability"
                  defaultValue={values.availability}
                >
                  {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Ред на показване" htmlFor="p-order">
                <Input
                  id="p-order"
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={values.sortOrder}
                />
              </Field>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-line pt-4">
              <Checkbox
                name="isFeatured"
                defaultChecked={values.isFeatured}
                label="Показвай на началната страница"
              />
              <Checkbox
                name="isCustomizable"
                defaultChecked={values.isCustomizable}
                label="Може да се персонализира"
                description="Показва бутон „Персонализирай“ при продукта."
              />
            </div>
          </Card>

          <Card
            title="Снимки"
            description="Първата снимка се използва като основна."
          >
            {images.length > 0 ? (
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((image) => (
                  <li
                    key={image.id}
                    className="relative overflow-hidden rounded-[var(--radius-sm)] border border-line"
                  >
                    <span className="relative block aspect-[4/3] bg-surface-sunk">
                      <Image
                        src={image.path}
                        alt={image.alt}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                    </span>
                    <span className="absolute right-1.5 top-1.5">
                      <ConfirmAction
                        action={deleteProductImage}
                        hiddenFields={{ imageId: image.id }}
                        label={<Trash2 size={13} aria-hidden="true" />}
                        title="Премахване на снимка"
                        message="Снимката ще бъде изтрита окончателно."
                        confirmLabel="Изтрий"
                        className="size-9 min-h-0 px-0"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <Field
              label="Добави снимки"
              hint="JPG, PNG или WEBP. Качват се при запазване."
              htmlFor="p-images"
            >
              <input
                id="p-images"
                name="images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="block w-full text-[0.86rem] file:mr-3 file:rounded-full file:border file:border-line file:bg-paper file:px-4 file:py-2 file:text-[0.84rem] file:font-semibold hover:file:border-ink"
              />
            </Field>
          </Card>

          <Card
            title="Състав и алергени"
            description="Попълва се само ако сте сигурни — не се предполага нищо автоматично."
          >
            <Field label="Съставки" htmlFor="p-ingredients">
              <Textarea
                id="p-ingredients"
                name="ingredients"
                defaultValue={values.ingredients}
                maxLength={2000}
                className="min-h-24"
              />
            </Field>

            <fieldset className="mt-4">
              <legend className="text-[0.79rem] font-extrabold text-ink-soft">
                Алергени
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {ALLERGEN_OPTIONS.map((allergen) => (
                  <Checkbox
                    key={allergen}
                    name="allergens"
                    value={allergen}
                    defaultChecked={values.allergens.includes(allergen)}
                    label={allergen}
                  />
                ))}
              </div>
            </fieldset>

            <Field
              label="Бележка за алергени"
              className="mt-4"
              htmlFor="p-allergen-note"
            >
              <Input
                id="p-allergen-note"
                name="allergenNote"
                defaultValue={values.allergenNote}
                maxLength={600}
                placeholder="напр. Произвежда се в кухня, в която се използват ядки."
              />
            </Field>
          </Card>

          <Card
            title="Доставка"
            description="Не всеки десерт понася куриерска доставка — вие решавате."
          >
            <div className="space-y-2.5">
              <Checkbox
                name="pickupAllowed"
                defaultChecked={values.pickupAllowed}
                label="Може да се взема на място"
              />
              <Checkbox
                name="shippingAllowed"
                checked={shippingAllowed}
                onChange={(event) => setShippingAllowed(event.target.checked)}
                label="Може да се изпраща с Еконт"
                description="Ако е изключено, клиентът няма да види опция за доставка."
              />
            </div>

            {shippingAllowed ? (
              <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-5">
                <Field label="Тегло (кг)" htmlFor="p-ship-weight">
                  <Input
                    id="p-ship-weight"
                    name="shipWeightKg"
                    inputMode="decimal"
                    defaultValue={values.shipWeightKg}
                    placeholder="1.20"
                  />
                </Field>
                <Field label="Дължина (см)" htmlFor="p-ship-l">
                  <Input
                    id="p-ship-l"
                    name="shipLengthCm"
                    type="number"
                    min={1}
                    defaultValue={values.shipLengthCm}
                  />
                </Field>
                <Field label="Ширина (см)" htmlFor="p-ship-w">
                  <Input
                    id="p-ship-w"
                    name="shipWidthCm"
                    type="number"
                    min={1}
                    defaultValue={values.shipWidthCm}
                  />
                </Field>
                <Field label="Височина (см)" htmlFor="p-ship-h">
                  <Input
                    id="p-ship-h"
                    name="shipHeightCm"
                    type="number"
                    min={1}
                    defaultValue={values.shipHeightCm}
                  />
                </Field>
                <Field label="Брой пакети" htmlFor="p-ship-packs">
                  <Input
                    id="p-ship-packs"
                    name="packageCount"
                    type="number"
                    min={1}
                    defaultValue={values.packageCount}
                  />
                </Field>
              </div>
            ) : (
              <>
                <input type="hidden" name="shipWeightKg" value={values.shipWeightKg} />
                <input type="hidden" name="shipLengthCm" value={values.shipLengthCm} />
                <input type="hidden" name="shipWidthCm" value={values.shipWidthCm} />
                <input type="hidden" name="shipHeightCm" value={values.shipHeightCm} />
                <input type="hidden" name="packageCount" value={values.packageCount} />
              </>
            )}
          </Card>

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
            <SubmitButton pending={pending}>Запази</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
