"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calculator,
  ExternalLink,
  FileText,
  Printer,
  RefreshCw,
  Truck,
} from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  QuickAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { CopyButton } from "@/components/admin/CopyButton";
import { Card, DefinitionList } from "@/components/admin/ui";
import { Checkbox, Field, Input, OptionCard } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatPrice } from "@/lib/format";
import {
  calculateEcontShipment,
  createEcontShipment,
  refreshEcontStatus,
  voidEcontShipmentRecord,
} from "@/server/admin/econt";

export type ShipmentView = {
  id: string;
  shipmentNumber: string;
  pdfUrl: string | null;
  totalPriceCents: number | null;
  currency: string | null;
  expectedDeliveryDate: string | null;
  environment: string;
  trackingStatus: string | null;
  trackingUpdatedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
};

export type ShipmentDefaults = {
  orderId: string;
  receiverName: string;
  receiverPhone: string;
  receiverEmail: string;
  deliveryTo: "office" | "address";
  officeCode: string;
  officeName: string;
  cityId: string;
  cityName: string;
  postCode: string;
  quarter: string;
  street: string;
  streetNum: string;
  other: string;
  packCount: string;
  weightKg: string;
  description: string;
};

/**
 * Econt waybill management.
 *
 * Creating a waybill costs real money, so the flow is: review a prefilled
 * form, optionally price it first, then create. A second waybill for the same
 * order requires an explicit confirmation.
 */
export function EcontPanel({
  shipments,
  defaults,
  configured,
  environment,
  trackingBaseUrl,
}: {
  shipments: ShipmentView[];
  defaults: ShipmentDefaults;
  configured: boolean;
  environment: string;
  trackingBaseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [deliveryTo, setDeliveryTo] = useState(defaults.deliveryTo);
  const active = shipments.filter((s) => !s.voidedAt);

  return (
    <Card
      title="Еконт"
      description={
        configured
          ? `Активна среда: ${environment === "demo" ? "демо (тестова)" : "продукция"}.`
          : undefined
      }
      actions={
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!configured}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.86rem] font-semibold text-paper transition-colors hover:bg-cocoa disabled:opacity-50"
        >
          <Truck size={15} aria-hidden="true" />
          Създай товарителница
        </button>
      }
    >
      {!configured ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft px-4 py-3 text-[0.86rem] text-warning">
          <AlertTriangle size={15} aria-hidden="true" className="mt-0.5 flex-none" />
          Интеграцията с Еконт не е конфигурирана. Попълнете ECONT_USERNAME и
          ECONT_PASSWORD в средата, за да създавате товарителници.
        </p>
      ) : null}

      {shipments.length === 0 ? (
        <p className="text-[0.88rem] text-ink-soft">
          За тази поръчка още няма създадена товарителница.
        </p>
      ) : (
        <ul className="space-y-4">
          {shipments.map((shipment) => (
            <li
              key={shipment.id}
              className="rounded-[var(--radius-sm)] border border-line p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] text-[1.3rem] tabular-nums">
                    {shipment.shipmentNumber}
                  </span>
                  {shipment.voidedAt ? (
                    <Badge tone="danger">Невалидна</Badge>
                  ) : (
                    <Badge tone="positive">Активна</Badge>
                  )}
                  {shipment.environment === "demo" ? (
                    <Badge tone="warning">Демо</Badge>
                  ) : null}
                </div>
              </div>

              <DefinitionList
                className="mt-3"
                items={[
                  {
                    label: "Цена на доставката",
                    value:
                      formatPrice(shipment.totalPriceCents) ??
                      "няма информация",
                  },
                  {
                    label: "Очаквана доставка",
                    value: shipment.expectedDeliveryDate
                      ? formatDate(shipment.expectedDeliveryDate)
                      : "—",
                  },
                  {
                    label: "Статус в Еконт",
                    value: shipment.trackingStatus ?? "не е проверяван",
                  },
                ]}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {shipment.pdfUrl ? (
                  <>
                    <a
                      href={shipment.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.84rem] font-semibold transition-colors hover:border-ink"
                    >
                      <FileText size={14} aria-hidden="true" />
                      Отвори PDF
                    </a>
                    <a
                      href={shipment.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.84rem] font-semibold transition-colors hover:border-ink"
                    >
                      <Printer size={14} aria-hidden="true" />
                      Принтирай етикета
                    </a>
                  </>
                ) : null}

                <CopyButton
                  value={shipment.shipmentNumber}
                  label="Копирай номера"
                />

                <a
                  href={`${trackingBaseUrl}${encodeURIComponent(shipment.shipmentNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.84rem] font-semibold transition-colors hover:border-ink"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Проследи
                </a>

                <QuickAction
                  action={refreshEcontStatus}
                  hiddenFields={{ shipmentId: shipment.id }}
                  label={
                    <>
                      <RefreshCw size={14} aria-hidden="true" />
                      Обнови статуса
                    </>
                  }
                />

                {!shipment.voidedAt ? (
                  <ConfirmAction
                    action={voidEcontShipmentRecord}
                    hiddenFields={{ shipmentId: shipment.id }}
                    label="Маркирай като невалидна"
                    title="Маркиране като невалидна"
                    message="Товарителницата ще се отбележи като невалидна в системата. Самата пратка се отказва от портала на Еконт."
                    confirmLabel="Маркирай"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Създаване на товарителница"
        description="Прегледайте и коригирайте данните, преди пратката да бъде подадена към Еконт."
        size="lg"
      >
        <ActionForm
          id="econt-shipment-form"
          action={createEcontShipment}
          onSuccess={() => setOpen(false)}
          className="space-y-5"
        >
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="orderId" value={defaults.orderId} />
              <input type="hidden" name="deliveryTo" value={deliveryTo} />

              <section>
                <h3 className="text-[0.95rem] font-bold">Получател</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Име"
                    required
                    error={fieldErrors.receiverName}
                    htmlFor="ec-name"
                  >
                    <Input
                      id="ec-name"
                      name="receiverName"
                      defaultValue={defaults.receiverName}
                      required
                    />
                  </Field>
                  <Field
                    label="Телефон"
                    required
                    error={fieldErrors.receiverPhone}
                    htmlFor="ec-phone"
                  >
                    <Input
                      id="ec-phone"
                      name="receiverPhone"
                      defaultValue={defaults.receiverPhone}
                      required
                    />
                  </Field>
                  <Field label="Имейл" htmlFor="ec-email">
                    <Input
                      id="ec-email"
                      name="receiverEmail"
                      type="email"
                      defaultValue={defaults.receiverEmail}
                    />
                  </Field>
                </div>
              </section>

              <section>
                <h3 className="text-[0.95rem] font-bold">Доставка до</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <OptionCard
                    selected={deliveryTo === "office"}
                    title="Офис на Еконт"
                    onSelect={() => setDeliveryTo("office")}
                  />
                  <OptionCard
                    selected={deliveryTo === "address"}
                    title="Адрес на получателя"
                    onSelect={() => setDeliveryTo("address")}
                  />
                </div>

                {deliveryTo === "office" ? (
                  <div className="mt-3">
                    <Field
                      label="Код на офиса"
                      required
                      hint={
                        defaults.officeName
                          ? `Избран от клиента: ${defaults.officeName}`
                          : "Кодът е видим в списъка с офиси на Еконт."
                      }
                      error={fieldErrors.officeCode}
                      htmlFor="ec-office"
                    >
                      <Input
                        id="ec-office"
                        name="officeCode"
                        defaultValue={defaults.officeCode}
                        required
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      label="ID на населеното място"
                      required
                      hint="От номенклатурата на Еконт."
                      error={fieldErrors.cityId}
                      htmlFor="ec-city-id"
                    >
                      <Input
                        id="ec-city-id"
                        name="cityId"
                        type="number"
                        defaultValue={defaults.cityId}
                        required
                      />
                    </Field>
                    <Field label="Населено място" htmlFor="ec-city">
                      <Input
                        id="ec-city"
                        name="cityName"
                        defaultValue={defaults.cityName}
                      />
                    </Field>
                    <Field label="Пощенски код" htmlFor="ec-post">
                      <Input
                        id="ec-post"
                        name="postCode"
                        defaultValue={defaults.postCode}
                      />
                    </Field>
                    <Field label="Квартал" htmlFor="ec-quarter">
                      <Input
                        id="ec-quarter"
                        name="quarter"
                        defaultValue={defaults.quarter}
                      />
                    </Field>
                    <Field
                      label="Улица"
                      hint="Точно както е в номенклатурата, вкл. „ул.“ / „бул.“."
                      error={fieldErrors.street}
                      htmlFor="ec-street"
                    >
                      <Input
                        id="ec-street"
                        name="street"
                        defaultValue={defaults.street}
                      />
                    </Field>
                    <Field label="Номер" htmlFor="ec-num">
                      <Input
                        id="ec-num"
                        name="streetNum"
                        defaultValue={defaults.streetNum}
                      />
                    </Field>
                    <Field
                      label="Допълнително"
                      className="sm:col-span-2"
                      htmlFor="ec-other"
                    >
                      <Input
                        id="ec-other"
                        name="other"
                        defaultValue={defaults.other}
                      />
                    </Field>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-[0.95rem] font-bold">Пратка</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Описание"
                    required
                    error={fieldErrors.description}
                    htmlFor="ec-desc"
                    className="sm:col-span-2"
                  >
                    <Input
                      id="ec-desc"
                      name="description"
                      defaultValue={defaults.description}
                      required
                    />
                  </Field>
                  <Field
                    label="Тегло (кг)"
                    required
                    error={fieldErrors.weightKg}
                    htmlFor="ec-weight"
                  >
                    <Input
                      id="ec-weight"
                      name="weightKg"
                      type="number"
                      step="0.05"
                      min="0.05"
                      defaultValue={defaults.weightKg}
                      required
                    />
                  </Field>
                  <Field
                    label="Брой пакети"
                    required
                    error={fieldErrors.packCount}
                    htmlFor="ec-packs"
                  >
                    <Input
                      id="ec-packs"
                      name="packCount"
                      type="number"
                      min="1"
                      defaultValue={defaults.packCount}
                      required
                    />
                  </Field>
                  <Field
                    label="Обявена стойност (EUR)"
                    hint="Незадължително."
                    htmlFor="ec-declared"
                  >
                    <Input
                      id="ec-declared"
                      name="declaredValueEur"
                      type="number"
                      step="0.01"
                      min="0"
                    />
                  </Field>
                  <Field
                    label="Наложен платеж (EUR)"
                    hint="Оставете празно, ако няма."
                    htmlFor="ec-cod"
                  >
                    <Input
                      id="ec-cod"
                      name="codAmountEur"
                      type="number"
                      step="0.01"
                      min="0"
                    />
                  </Field>
                </div>

                <div className="mt-4 space-y-2.5">
                  <Checkbox
                    name="keepUpright"
                    defaultChecked
                    label="Пази изправено"
                    description="Препоръчително за торти и десерти."
                  />
                  {active.length > 0 ? (
                    <Checkbox
                      name="confirmDuplicate"
                      label="Да, създай втора товарителница"
                      description={`За тази поръчка вече има активна товарителница ${active[0].shipmentNumber}.`}
                    />
                  ) : null}
                </div>
              </section>

              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <CalculateButton formId="econt-shipment-form" />
                <SubmitButton pending={pending}>
                  Създай товарителница
                </SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      </Modal>
    </Card>
  );
}

/**
 * Prices the shipment without creating it, reusing whatever is currently in
 * the form. Kept separate from the submit button so the result is reported
 * through the same toast pipeline as every other admin action.
 */
function CalculateButton({ formId }: { formId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    setBusy(true);
    try {
      const result = await calculateEcontShipment(new FormData(form));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      console.error(error);
      toast.error("Изчислението не беше извършено.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.86rem] font-semibold transition-colors hover:border-ink disabled:opacity-60"
    >
      <Calculator size={14} aria-hidden="true" />
      {busy ? "Изчисляване…" : "Изчисли цената"}
    </button>
  );
}
