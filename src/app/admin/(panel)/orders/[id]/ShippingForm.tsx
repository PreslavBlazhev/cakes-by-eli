"use client";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Field, Input } from "@/components/ui/form";
import { updateShippingDetails } from "@/server/admin/orders";

/**
 * Parcel data for the waybill.
 *
 * Product defaults prefill these values, but the owner always confirms them:
 * the configurator has no honest way to derive a real packed weight from
 * cosmetic choices.
 */
export function ShippingForm({
  orderId,
  defaults,
}: {
  orderId: string;
  defaults: {
    shippingWeightKg: string;
    shippingLengthCm: string;
    shippingWidthCm: string;
    shippingHeightCm: string;
    packageCount: string;
    shippingDescription: string;
    shipRecipientName: string;
    shipRecipientPhone: string;
  };
}) {
  return (
    <ActionForm action={updateShippingDetails} className="space-y-4">
      {({ pending, fieldErrors }) => (
        <>
          <input type="hidden" name="orderId" value={orderId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Получател"
              error={fieldErrors.shipRecipientName}
              htmlFor="ship-recipient"
            >
              <Input
                id="ship-recipient"
                name="shipRecipientName"
                defaultValue={defaults.shipRecipientName}
                maxLength={80}
              />
            </Field>
            <Field
              label="Телефон на получателя"
              error={fieldErrors.shipRecipientPhone}
              htmlFor="ship-recipient-phone"
            >
              <Input
                id="ship-recipient-phone"
                name="shipRecipientPhone"
                defaultValue={defaults.shipRecipientPhone}
                inputMode="tel"
                maxLength={24}
              />
            </Field>
          </div>

          <Field
            label="Описание на пратката"
            hint="Изписва се на товарителницата."
            error={fieldErrors.shippingDescription}
            htmlFor="ship-description"
          >
            <Input
              id="ship-description"
              name="shippingDescription"
              defaultValue={defaults.shippingDescription}
              maxLength={250}
              required
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Field
              label="Тегло (кг)"
              error={fieldErrors.shippingWeightKg}
              htmlFor="ship-weight"
            >
              <Input
                id="ship-weight"
                name="shippingWeightKg"
                type="number"
                step="0.05"
                min="0.05"
                defaultValue={defaults.shippingWeightKg}
                required
              />
            </Field>
            <Field
              label="Дължина (см)"
              error={fieldErrors.shippingLengthCm}
              htmlFor="ship-length"
            >
              <Input
                id="ship-length"
                name="shippingLengthCm"
                type="number"
                min="1"
                defaultValue={defaults.shippingLengthCm}
                required
              />
            </Field>
            <Field
              label="Ширина (см)"
              error={fieldErrors.shippingWidthCm}
              htmlFor="ship-width"
            >
              <Input
                id="ship-width"
                name="shippingWidthCm"
                type="number"
                min="1"
                defaultValue={defaults.shippingWidthCm}
                required
              />
            </Field>
            <Field
              label="Височина (см)"
              error={fieldErrors.shippingHeightCm}
              htmlFor="ship-height"
            >
              <Input
                id="ship-height"
                name="shippingHeightCm"
                type="number"
                min="1"
                defaultValue={defaults.shippingHeightCm}
                required
              />
            </Field>
            <Field
              label="Брой пакети"
              error={fieldErrors.packageCount}
              htmlFor="ship-packs"
            >
              <Input
                id="ship-packs"
                name="packageCount"
                type="number"
                min="1"
                defaultValue={defaults.packageCount}
                required
              />
            </Field>
          </div>

          <SubmitButton pending={pending} variant="secondary">
            Запази данните за пратката
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
