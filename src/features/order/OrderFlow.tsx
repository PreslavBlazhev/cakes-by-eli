"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Phone } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/Button";
import {
  Checkbox,
  ChoiceCard,
  Field,
  Input,
  OptionCard,
  Select,
  Textarea,
} from "@/components/ui/form";
import {
  Badge,
  Container,
  ErrorNotice,
  Eyebrow,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import {
  buildSummary,
  estimatePrice,
  validateState,
  withDefaults,
} from "@/features/configurator/rules";
import type { ConfigState } from "@/features/configurator/types";
import { cn } from "@/lib/cn";
import { formatPrice, formatPriceOrPending } from "@/lib/format";
import type { FulfillmentMethod } from "@/lib/labels";
import { PREFERRED_CONTACT_LABELS } from "@/lib/labels";
import { submitOrder } from "@/server/orders/actions";
import type { SubmitOrderState } from "@/server/orders/actions";
import { AttachmentPicker } from "./AttachmentPicker";
import { CustomBuilder } from "./CustomBuilder";
import { DeliveryPicker, EMPTY_SHIPPING } from "./DeliveryPicker";
import type { ShippingDetails } from "./DeliveryPicker";
import { clearDraft, loadDraft, saveDraft } from "./draft";
import type { OrderFlowData } from "./types";

type Mode = "catalog" | "custom";

const initialState: SubmitOrderState = { status: "idle" };

export function OrderFlow({ data }: { data: OrderFlowData }) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode | null>(data.initial.mode);
  const [productId, setProductId] = useState<string | null>(
    data.initial.productId,
  );
  const [dessertId, setDessertId] = useState<string | null>(
    data.initial.dessertTypeId ??
      (data.initial.mode === "custom" ? (data.desserts[0]?.id ?? null) : null),
  );
  const [configState, setConfigState] = useState<ConfigState>(() => {
    const initialDessert = data.desserts.find(
      (d) =>
        d.id ===
        (data.initial.dessertTypeId ??
          (data.initial.mode === "custom" ? data.desserts[0]?.id : null)),
    );
    return initialDessert ? withDefaults(initialDessert) : {};
  });
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentDate, setFulfillmentDate] = useState("");
  const [occasion, setOccasion] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [preferredContact, setPreferredContact] =
    useState<keyof typeof PREFERRED_CONTACT_LABELS>("PHONE");
  const [requestedMethod, setFulfillmentMethod] =
    useState<FulfillmentMethod>("PICKUP");
  const [shipping, setShipping] = useState<ShippingDetails>(EMPTY_SHIPPING);
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);

  const [state, formAction, pending] = useActionState(submitOrder, initialState);

  const dessert = useMemo(
    () => data.desserts.find((d) => d.id === dessertId) ?? null,
    [data.desserts, dessertId],
  );
  const product = useMemo(
    () => data.products.find((p) => p.id === productId) ?? null,
    [data.products, productId],
  );

  /* ------------------------------------------------------------ Draft */

  // localStorage is unavailable during SSR, so the draft can only be read
  // after mount. This is the "sync from an external store" case the rule
  // documents; the single extra render on mount is intentional.
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    // A deep link (?product= / ?mode=custom) always wins over a stale draft.
    if (data.initial.mode || data.initial.productId || data.initial.dessertTypeId) {
      return;
    }
    if (!draft.mode) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(draft.mode);
    setProductId(draft.productId);
    setDessertId(draft.dessertTypeId);
    setConfigState(draft.configState ?? {});
    setQuantity(draft.quantity || 1);
    setFulfillmentDate(draft.fulfillmentDate ?? "");
    setOccasion(draft.occasion ?? "");
    setNotes(draft.notes ?? "");
    setDraftRestored(true);
  }, [data.initial]);

  useEffect(() => {
    if (!mode) return;
    saveDraft({
      mode,
      productId,
      dessertTypeId: dessertId,
      configState,
      quantity,
      fulfillmentDate,
      occasion,
      notes,
    });
  }, [
    mode,
    productId,
    dessertId,
    configState,
    quantity,
    fulfillmentDate,
    occasion,
    notes,
  ]);

  /* --------------------------------------------------- Submission side */

  useEffect(() => {
    if (state.status === "success") {
      clearDraft();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (state.status === "error") {
      toast.error(state.message);
      errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state, toast]);

  const serverErrors =
    state.status === "error" ? state.fieldErrors : ({} as Record<string, string>);
  const errors = { ...serverErrors, ...clientErrors };

  /* ------------------------------------------------------- Derivations */

  const summary = useMemo(() => {
    if (mode === "custom" && dessert) return buildSummary(dessert, configState);
    if (mode === "catalog" && product) {
      return [
        {
          groupKey: "product",
          groupLabel: "Продукт",
          value: product.name,
          optionKeys: [],
          priceCents: product.basePriceCents,
        },
        {
          groupKey: "category",
          groupLabel: "Категория",
          value: product.categoryName,
          optionKeys: [],
          priceCents: null,
        },
        ...(product.portions
          ? [
              {
                groupKey: "portions",
                groupLabel: "Порции",
                value: product.portions,
                optionKeys: [],
                priceCents: null,
              },
            ]
          : []),
      ];
    }
    return [];
  }, [mode, dessert, configState, product]);

  const price = useMemo(() => {
    if (mode === "custom" && dessert) {
      return estimatePrice(dessert, configState, quantity).totalCents;
    }
    if (mode === "catalog" && product?.basePriceCents !== null && product) {
      return (product.basePriceCents ?? 0) * quantity;
    }
    return null;
  }, [mode, dessert, configState, quantity, product]);

  const availableMethods = useMemo<FulfillmentMethod[]>(() => {
    if (mode === "catalog" && product) {
      const list: FulfillmentMethod[] = [];
      if (product.pickupAllowed) list.push("PICKUP");
      if (product.shippingAllowed) list.push("ECONT_OFFICE", "ECONT_ADDRESS");
      return list.length > 0 ? list : ["PICKUP"];
    }
    // Custom desserts are quoted individually; the owner confirms shipping
    // suitability, so both routes stay open here.
    return ["PICKUP", "ECONT_OFFICE", "ECONT_ADDRESS"];
  }, [mode, product]);

  // Which methods are offered depends on the chosen product, so the effective
  // method is derived rather than stored — it can never go stale.
  const fulfillmentMethod: FulfillmentMethod = availableMethods.includes(
    requestedMethod,
  )
    ? requestedMethod
    : (availableMethods[0] ?? "PICKUP");

  const blockedReason = useMemo(() => {
    if (!fulfillmentDate) return null;
    return (
      data.blockedDates.find((b) => b.date === fulfillmentDate)?.reason ?? null
    );
  }, [fulfillmentDate, data.blockedDates]);

  /* ------------------------------------------------------- Client side */

  function validateBeforeSubmit(): boolean {
    const next: Record<string, string> = {};

    if (mode === "catalog" && !productId) {
      next.productId = "Моля, изберете продукт.";
    }
    if (mode === "custom" && !dessertId) {
      next.dessertTypeId = "Моля, изберете вид десерт.";
    }
    if (mode === "custom" && dessert) {
      for (const issue of validateState(dessert, configState)) {
        next[`config.${issue.groupKey}`] = issue.message;
      }
    }
    if (customerName.trim().length < 2) next.customerName = "Моля, въведете име.";
    if (customerPhone.trim().length < 6)
      next.customerPhone = "Моля, въведете телефон.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()))
      next.customerEmail = "Моля, въведете валиден имейл.";
    if (!consent) next.consent = "Необходимо е съгласие за обработка на данните.";
    if (blockedReason) next.fulfillmentDate = blockedReason;

    if (fulfillmentMethod !== "PICKUP") {
      if (!shipping.recipientName.trim())
        next["shipping.recipientName"] = "Моля, въведете име на получателя.";
      if (!shipping.cityId)
        next["shipping.cityName"] = "Моля, изберете населено място.";
      if (fulfillmentMethod === "ECONT_OFFICE" && !shipping.officeCode)
        next["shipping.officeCode"] = "Моля, изберете офис.";
      if (
        fulfillmentMethod === "ECONT_ADDRESS" &&
        !(shipping.street && shipping.streetNum) &&
        !shipping.other
      ) {
        next["shipping.street"] =
          "Посочете улица и номер или попълнете допълнително описание.";
      }
    }

    setClientErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildFormData(): FormData | null {
    if (!validateBeforeSubmit()) {
      errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return null;
    }

    const payload = {
      orderType: mode === "custom" ? "CUSTOM" : "CATALOG",
      productId: mode === "catalog" ? productId : undefined,
      dessertTypeId: mode === "custom" ? dessertId : undefined,
      configState: mode === "custom" ? configState : undefined,
      quantity,
      fulfillmentDate: fulfillmentDate || undefined,
      occasion,
      notes,
      customerName,
      customerPhone,
      customerEmail,
      preferredContact,
      fulfillmentMethod,
      shipping:
        fulfillmentMethod === "PICKUP"
          ? undefined
          : { ...shipping, cityId: shipping.cityId ?? null },
      consent: true as const,
    };

    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    for (const file of files) formData.append("files", file);
    return formData;
  }

  /* ------------------------------------------------------------ Render */

  if (state.status === "success") {
    return (
      <SuccessScreen
        orderNumber={state.orderNumber}
        email={customerEmail}
        disclaimer={data.disclaimer}
        phone={data.phone}
      />
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const built = buildFormData();
        if (!built) return;
        // Replace the browser-collected FormData with our validated payload.
        for (const key of [...formData.keys()]) formData.delete(key);
        for (const [key, value] of built.entries()) formData.append(key, value);
        return formAction(formData);
      }}
      noValidate
    >
      <Container>
        {/* ------------------------------------------------ Mode chooser */}
        <AnimatePresence mode="wait" initial={false}>
          {mode === null ? (
            <motion.div
              key="chooser"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceCard
                  selected={false}
                  onSelect={() => setMode("catalog")}
                  eyebrow="Вариант A"
                  title="Готов продукт"
                  description="Изберете нещо от менюто и попълнете детайлите за поръчката."
                  illustration={<CatalogIllustration />}
                />
                <ChoiceCard
                  selected={false}
                  onSelect={() => {
                    setMode("custom");
                    if (!dessertId) setDessertId(data.desserts[0]?.id ?? null);
                  }}
                  eyebrow="Вариант B"
                  title="Персонална поръчка"
                  description="Съставете свой десерт стъпка по стъпка и го вижте на живо."
                  illustration={<CustomIllustration />}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`mode-${mode}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setClientErrors({});
                  }}
                  className="inline-flex items-center gap-2 text-[0.86rem] font-semibold text-ink-soft transition-colors hover:text-rose-dark"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Смени вида поръчка
                </button>
                <Badge tone="rose">
                  {mode === "custom" ? "Персонална поръчка" : "Готов продукт"}
                </Badge>
              </div>

              {draftRestored ? (
                <div className="mb-6 rounded-[var(--radius-sm)] border border-info/25 bg-info-soft px-4 py-3 text-[0.86rem] text-info">
                  Възстановихме последната ви незавършена заявка.{" "}
                  <button
                    type="button"
                    className="font-bold underline underline-offset-4"
                    onClick={() => {
                      clearDraft();
                      setDraftRestored(false);
                      setConfigState(dessert ? withDefaults(dessert) : {});
                      setProductId(null);
                      setQuantity(1);
                      setFulfillmentDate("");
                      setOccasion("");
                      setNotes("");
                    }}
                  >
                    Започни отначало
                  </button>
                </div>
              ) : null}

              {state.status === "error" ? (
                <div ref={errorRef}>
                  <ErrorNotice className="mb-6">
                    <p>{state.message}</p>
                  </ErrorNotice>
                </div>
              ) : Object.keys(clientErrors).length > 0 ? (
                <div ref={errorRef}>
                  <ErrorNotice className="mb-6" title="Липсва информация">
                    <p>Моля, проверете отбелязаните полета по-долу.</p>
                  </ErrorNotice>
                </div>
              ) : (
                <div ref={errorRef} />
              )}

              {/* ------------------------------------------ Catalog mode */}
              {mode === "catalog" ? (
                <CatalogPicker
                  data={data}
                  productId={productId}
                  onSelect={setProductId}
                  error={errors.productId}
                />
              ) : null}

              {/* ------------------------------------------- Custom mode */}
              {mode === "custom" ? (
                <div className="space-y-7">
                  <section className="panel p-5 sm:p-6">
                    <Eyebrow>Вид десерт</Eyebrow>
                    <h2 className="display-3 mt-2">Какво ще създаваме?</h2>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {data.desserts.map((option) => (
                        <OptionCard
                          key={option.id}
                          selected={option.id === dessertId}
                          title={option.name}
                          description={option.description || undefined}
                          onSelect={() => {
                            if (option.id === dessertId) return;
                            setDessertId(option.id);
                            setConfigState(withDefaults(option));
                            setClientErrors({});
                          }}
                        />
                      ))}
                    </div>
                    {errors.dessertTypeId ? (
                      <p className="mt-2 text-[0.78rem] font-semibold text-danger">
                        {errors.dessertTypeId}
                      </p>
                    ) : null}
                  </section>

                  {dessert ? (
                    <CustomBuilder
                      dessert={dessert}
                      state={configState}
                      onChange={setConfigState}
                      errors={errors}
                    />
                  ) : null}
                </div>
              ) : null}

              {/* -------------------------------------------- Order info */}
              <section className="panel mt-7 p-5 sm:p-7">
                <Eyebrow>Детайли по поръчката</Eyebrow>
                <h2 className="display-3 mt-2">Кога и за какъв повод?</h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Желана дата"
                    hint="Наличността се потвърждава допълнително."
                    error={errors.fulfillmentDate}
                    htmlFor="fulfillment-date"
                  >
                    <Input
                      id="fulfillment-date"
                      type="date"
                      min={data.minDate}
                      value={fulfillmentDate}
                      invalid={Boolean(errors.fulfillmentDate)}
                      onChange={(e) => setFulfillmentDate(e.target.value)}
                    />
                  </Field>

                  <Field label="Повод" htmlFor="occasion">
                    <Input
                      id="occasion"
                      value={occasion}
                      placeholder="Рожден ден, сватба…"
                      maxLength={120}
                      onChange={(e) => setOccasion(e.target.value)}
                    />
                  </Field>

                  <Field
                    label="Количество"
                    hint={mode === "catalog" ? "Брой продукти." : "Брой десерти."}
                    htmlFor="quantity"
                  >
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={500}
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </Field>
                </div>

                {blockedReason ? (
                  <p className="mt-3 rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft px-4 py-3 text-[0.86rem] text-warning">
                    {blockedReason}
                  </p>
                ) : null}

                <div className="mt-5">
                  <Field
                    label="Допълнителни бележки"
                    hint="Всичко друго, което е важно да знаем."
                    htmlFor="notes"
                  >
                    <Textarea
                      id="notes"
                      value={notes}
                      maxLength={2000}
                      placeholder="Например: тортата е изненада, ще я вземем в 17:00…"
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-5">
                  <AttachmentPicker
                    files={files}
                    onChange={setFiles}
                    maxFiles={data.maxFiles}
                    maxFileMb={data.maxFileMb}
                    error={errors.files}
                  />
                </div>
              </section>

              {/* --------------------------------------------- Delivery */}
              <section className="panel mt-5 p-5 sm:p-7">
                <Eyebrow>Получаване</Eyebrow>
                <h2 className="display-3 mb-5 mt-2">Как да стигне до вас?</h2>
                <DeliveryPicker
                  method={fulfillmentMethod}
                  onMethodChange={setFulfillmentMethod}
                  value={shipping}
                  onChange={setShipping}
                  availableMethods={availableMethods}
                  errors={errors}
                  econtEnabled={data.econtEnabled}
                />
              </section>

              {/* --------------------------------------------- Customer */}
              <section className="panel mt-5 p-5 sm:p-7">
                <Eyebrow>Вашите данни</Eyebrow>
                <h2 className="display-3 mt-2">Как да се свържем с вас?</h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Име"
                    required
                    error={errors.customerName}
                    htmlFor="customer-name"
                  >
                    <Input
                      id="customer-name"
                      value={customerName}
                      autoComplete="name"
                      maxLength={80}
                      invalid={Boolean(errors.customerName)}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </Field>

                  <Field
                    label="Телефон"
                    required
                    error={errors.customerPhone}
                    htmlFor="customer-phone"
                  >
                    <Input
                      id="customer-phone"
                      value={customerPhone}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="08…"
                      maxLength={24}
                      invalid={Boolean(errors.customerPhone)}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </Field>

                  <Field
                    label="Имейл"
                    required
                    hint="Изпращаме потвърждение на този адрес."
                    error={errors.customerEmail}
                    htmlFor="customer-email"
                  >
                    <Input
                      id="customer-email"
                      type="email"
                      value={customerEmail}
                      autoComplete="email"
                      maxLength={160}
                      invalid={Boolean(errors.customerEmail)}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </Field>

                  <Field label="Предпочитан контакт" htmlFor="preferred-contact">
                    <Select
                      id="preferred-contact"
                      value={preferredContact}
                      onChange={(e) =>
                        setPreferredContact(
                          e.target.value as keyof typeof PREFERRED_CONTACT_LABELS,
                        )
                      }
                    >
                      {Object.entries(PREFERRED_CONTACT_LABELS).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </Select>
                  </Field>
                </div>

                <div className="mt-6 rounded-[var(--radius-sm)] border border-line bg-cream/70 p-4">
                  <Checkbox
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    label={
                      <>
                        Съгласен/на съм личните ми данни да бъдат обработени за
                        целите на тази поръчка съгласно{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline underline-offset-4"
                        >
                          политиката за поверителност
                        </a>
                        .
                      </>
                    }
                  />
                  {errors.consent ? (
                    <p className="mt-2 text-[0.78rem] font-semibold text-danger">
                      {errors.consent}
                    </p>
                  ) : null}
                </div>
              </section>

              {/* ---------------------------------------------- Summary */}
              <section className="panel mt-5 overflow-hidden">
                <div className="border-b border-line bg-blush-soft px-5 py-4 sm:px-7">
                  <Eyebrow>Обобщение</Eyebrow>
                  <h2 className="display-3 mt-1.5">
                    {mode === "custom"
                      ? `Вашият ${dessert?.name.toLowerCase() ?? "десерт"}`
                      : "Вашата поръчка"}
                  </h2>
                </div>

                <div className="px-5 py-5 sm:px-7">
                  {summary.length === 0 ? (
                    <p className="text-[0.92rem] text-ink-soft">
                      Направете първите избори, за да видите обобщението.
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {summary.map((line) => (
                        <li
                          key={line.groupKey}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line pb-2.5 last:border-0"
                        >
                          <span className="text-[0.84rem] text-ink-faint">
                            {line.groupLabel}
                          </span>
                          <span className="text-right text-[0.94rem] font-semibold">
                            {line.value}
                          </span>
                        </li>
                      ))}
                      <li className="flex flex-wrap items-baseline justify-between gap-x-4 pt-1">
                        <span className="text-[0.84rem] text-ink-faint">
                          Количество
                        </span>
                        <span className="text-[0.94rem] font-semibold">
                          {quantity}
                        </span>
                      </li>
                    </ul>
                  )}

                  <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--radius-sm)] bg-cream px-4 py-3.5">
                    <span className="text-[0.86rem] font-bold">
                      {price === null
                        ? "Цена"
                        : "Ориентировъчна цена"}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-[1.45rem]">
                      {formatPriceOrPending(price)}
                    </span>
                  </div>

                  <p className="mt-4 text-[0.82rem] leading-relaxed text-ink-soft">
                    {data.disclaimer}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      variant="rose"
                      size="lg"
                      disabled={pending}
                    >
                      {pending ? (
                        <>
                          <Loader2
                            size={17}
                            aria-hidden="true"
                            className="animate-spin"
                          />
                          Изпращане…
                        </>
                      ) : (
                        "Изпрати поръчката"
                      )}
                    </Button>
                    {data.phone ? (
                      <a
                        href={`tel:${data.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex min-h-14 items-center gap-2 px-2 text-[0.92rem] font-semibold text-ink-soft transition-colors hover:text-ink"
                      >
                        <Phone size={16} aria-hidden="true" />
                        Или се обадете: {data.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function CatalogPicker({
  data,
  productId,
  onSelect,
  error,
}: {
  data: OrderFlowData;
  productId: string | null;
  onSelect: (id: string) => void;
  error?: string;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const products = useMemo(
    () =>
      categoryId
        ? data.products.filter((p) => p.categoryId === categoryId)
        : data.products,
    [data.products, categoryId],
  );

  return (
    <section className="panel p-5 sm:p-6">
      <Eyebrow>Продукт</Eyebrow>
      <h2 className="display-3 mt-2">Какво да приготвим?</h2>

      {data.products.length === 0 ? (
        <p className="mt-4 text-[0.92rem] text-ink-soft">
          В момента няма публикувани продукти. Можете да опишете идеята си като
          персонална поръчка.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip
              active={categoryId === null}
              onClick={() => setCategoryId(null)}
            >
              Всички
            </FilterChip>
            {data.categories.map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </FilterChip>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {products.map((option) => (
              <OptionCard
                key={option.id}
                selected={option.id === productId}
                title={option.name}
                description={
                  [option.categoryName, option.portions]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                price={
                  option.basePriceCents !== null
                    ? `от ${formatPrice(option.basePriceCents)}`
                    : null
                }
                onSelect={() => onSelect(option.id)}
              />
            ))}
          </div>

          {products.length === 0 ? (
            <p className="mt-4 text-[0.9rem] text-ink-soft">
              В тази категория няма продукти.
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mt-3 text-[0.78rem] font-semibold text-danger">{error}</p>
      ) : null}
    </section>
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
        "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[0.82rem] font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-paper hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}

function SuccessScreen({
  orderNumber,
  email,
  disclaimer,
  phone,
}: {
  orderNumber: string;
  email: string;
  disclaimer: string;
  phone: string;
}) {
  return (
    <Container>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="panel mx-auto max-w-[680px] p-8 text-center sm:p-12"
      >
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-positive-soft text-positive">
          <CheckCircle2 size={30} aria-hidden="true" />
        </span>

        <h1 className="display-2 mt-6">Получихме вашето запитване</h1>

        <p className="mt-4 text-[1rem] text-ink-soft">
          Номер на поръчката
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-[2rem] tracking-[0.02em]">
          {orderNumber}
        </p>

        <p className="lede mx-auto mt-6">
          Изпратихме потвърждение на <strong className="text-ink">{email}</strong>.
          Ако не го намирате, проверете и папката за нежелана поща.
        </p>

        <p className="mx-auto mt-5 max-w-[520px] rounded-[var(--radius-sm)] bg-blush-soft px-5 py-4 text-[0.9rem] text-rose-deep">
          {disclaimer}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/menu" variant="rose">
            Обратно към менюто
          </ButtonLink>
          {phone ? (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-ink px-5 text-[0.92rem] font-semibold transition-colors hover:bg-ink hover:text-paper"
            >
              <Phone size={16} aria-hidden="true" />
              {phone}
            </a>
          ) : null}
        </div>
      </motion.div>
    </Container>
  );
}

/* --------------------------------------------------- Mode illustrations */

function CatalogIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="h-24 w-auto" aria-hidden="true">
      <ellipse cx="80" cy="98" rx="58" ry="8" fill="#3a2a25" opacity="0.12" />
      <rect x="26" y="30" width="42" height="62" rx="10" fill="#f7e7d3" stroke="#e3cdb0" />
      <rect x="72" y="18" width="42" height="74" rx="10" fill="#fdf6ec" stroke="#e3cdb0" />
      <rect x="118" y="42" width="30" height="50" rx="9" fill="#f2d7d7" stroke="#e3cdb0" />
      <circle cx="47" cy="45" r="7" fill="#c8515c" />
      <circle cx="93" cy="34" r="7" fill="#caa779" />
      <circle cx="133" cy="56" r="6" fill="#a7ad94" />
    </svg>
  );
}

function CustomIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="h-24 w-auto" aria-hidden="true">
      <ellipse cx="80" cy="98" rx="58" ry="8" fill="#3a2a25" opacity="0.12" />
      <path d="M44 92 V56 a36 8 0 0 1 72 0 V92 a36 8 0 0 1 -72 0 Z" fill="#fdf6ec" stroke="#e3cdb0" />
      <ellipse cx="80" cy="56" rx="36" ry="8" fill="#f7e7d3" />
      <path d="M58 52 V30 a22 6 0 0 1 44 0 V52" fill="#f2d7d7" stroke="#e3cdb0" />
      <ellipse cx="80" cy="30" rx="22" ry="6" fill="#fdf6ec" />
      <path d="M72 24 l6 -4 l-1 7 l5 -2 l-5 9 l-6 1 l2 -6 z" fill="#caa779" />
      <circle cx="62" cy="52" r="4.5" fill="#c8515c" />
      <circle cx="98" cy="52" r="4.5" fill="#c8515c" />
      <path d="M126 20 l4 -9 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 z" fill="#8f4e5d" opacity="0.55" />
    </svg>
  );
}
