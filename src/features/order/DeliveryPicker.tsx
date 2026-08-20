"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Loader2, MapPin, Search, Store } from "lucide-react";

import { Field, Input, OptionCard } from "@/components/ui/form";
import { ErrorNotice } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { FulfillmentMethod } from "@/lib/labels";
import { FULFILLMENT_LABELS } from "@/lib/labels";

export type ShippingDetails = {
  recipientName: string;
  recipientPhone: string;
  cityId: number | null;
  cityName: string;
  postCode: string;
  quarter: string;
  street: string;
  streetNum: string;
  other: string;
  officeCode: string;
  officeName: string;
};

export const EMPTY_SHIPPING: ShippingDetails = {
  recipientName: "",
  recipientPhone: "",
  cityId: null,
  cityName: "",
  postCode: "",
  quarter: "",
  street: "",
  streetNum: "",
  other: "",
  officeCode: "",
  officeName: "",
};

type CityItem = { id: number; name: string; postCode: string; region: string };
type OfficeItem = {
  code: string;
  name: string;
  cityName: string;
  address: string;
  isAutomated: boolean;
};

/**
 * Delivery selection.
 *
 * Cities, offices and streets all come from Econt's own nomenclature — free
 * text is not accepted for them, because Econt rejects a waybill whose city or
 * street does not match its records, and it does so with an error that points
 * at the wrong field.
 */
export function DeliveryPicker({
  method,
  onMethodChange,
  value,
  onChange,
  availableMethods,
  errors,
  econtEnabled,
}: {
  method: FulfillmentMethod;
  onMethodChange: (method: FulfillmentMethod) => void;
  value: ShippingDetails;
  onChange: (next: ShippingDetails) => void;
  availableMethods: FulfillmentMethod[];
  errors: Record<string, string>;
  econtEnabled: boolean;
}) {
  const needsShipping = method !== "PICKUP";

  const set = useCallback(
    (patch: Partial<ShippingDetails>) => onChange({ ...value, ...patch }),
    [onChange, value],
  );

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-[0.79rem] font-extrabold text-ink-soft">
          Как ще получите поръчката?
        </legend>
        <div role="radiogroup" className="mt-2.5 grid gap-2 sm:grid-cols-3">
          {(["PICKUP", "ECONT_OFFICE", "ECONT_ADDRESS"] as const).map((option) => {
            const enabled =
              availableMethods.includes(option) &&
              (option === "PICKUP" || econtEnabled);

            return (
              <OptionCard
                key={option}
                selected={method === option}
                disabled={!enabled}
                title={FULFILLMENT_LABELS[option]}
                description={
                  !enabled && option !== "PICKUP"
                    ? "Не е налично за този избор"
                    : undefined
                }
                onSelect={() => onMethodChange(option)}
              />
            );
          })}
        </div>
        {errors.fulfillmentMethod ? (
          <p className="mt-2 text-[0.78rem] font-semibold text-danger">
            {errors.fulfillmentMethod}
          </p>
        ) : null}
      </fieldset>

      {needsShipping ? (
        <div className="space-y-5 rounded-[var(--radius-md)] border border-line bg-cream/60 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Име на получателя"
              required
              error={errors["shipping.recipientName"]}
              htmlFor="ship-name"
            >
              <Input
                id="ship-name"
                value={value.recipientName}
                autoComplete="name"
                invalid={Boolean(errors["shipping.recipientName"])}
                onChange={(e) => set({ recipientName: e.target.value })}
              />
            </Field>
            <Field
              label="Телефон на получателя"
              hint="Ако е различен от вашия."
              error={errors["shipping.recipientPhone"]}
              htmlFor="ship-phone"
            >
              <Input
                id="ship-phone"
                value={value.recipientPhone}
                inputMode="tel"
                autoComplete="tel"
                placeholder="08…"
                invalid={Boolean(errors["shipping.recipientPhone"])}
                onChange={(e) => set({ recipientPhone: e.target.value })}
              />
            </Field>
          </div>

          <CityPicker
            value={value}
            onSelect={(city) =>
              set({
                cityId: city.id,
                cityName: city.name,
                postCode: city.postCode,
                street: "",
                officeCode: "",
                officeName: "",
              })
            }
            error={errors["shipping.cityName"]}
          />

          {method === "ECONT_OFFICE" ? (
            <OfficePicker
              cityId={value.cityId}
              selectedCode={value.officeCode}
              onSelect={(office) =>
                set({ officeCode: office.code, officeName: `${office.name} — ${office.address}` })
              }
              error={errors["shipping.officeCode"]}
            />
          ) : (
            <AddressFields value={value} set={set} errors={errors} />
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function useLookup<T>(kind: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (query: string, cityId?: number | null) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ kind, q: query });
        if (cityId) params.set("cityId", String(cityId));

        const response = await fetch(`/api/econt/lookup?${params}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { items?: T[]; error?: string };

        if (!response.ok) {
          setError(data.error ?? "Списъкът не може да бъде зареден.");
          setItems([]);
          return;
        }
        setItems(data.items ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Списъкът не може да бъде зареден в момента.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  return { items, loading, error, search, setItems };
}

function CityPicker({
  value,
  onSelect,
  error,
}: {
  value: ShippingDetails;
  onSelect: (city: CityItem) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { items, loading, error: lookupError, search } = useLookup<CityItem>("cities");

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = window.setTimeout(() => void search(query), 250);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  return (
    <div>
      <Field
        label="Населено място"
        required
        hint="Изберете от списъка на Еконт."
        error={error}
        htmlFor="ship-city"
      >
        <div className="relative">
          <Input
            id="ship-city"
            value={value.cityId ? `${value.cityName} (${value.postCode})` : query}
            placeholder="Започнете да пишете…"
            autoComplete="off"
            invalid={Boolean(error)}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (value.cityId) {
                onSelect({ id: 0, name: "", postCode: "", region: "" });
              }
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
          </span>
        </div>
      </Field>

      {lookupError ? (
        <ErrorNotice className="mt-2" title="Еконт">
          <p>{lookupError}</p>
        </ErrorNotice>
      ) : null}

      {open && items.length > 0 && !value.cityId ? (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-[var(--radius-sm)] border border-line bg-paper shadow-[var(--shadow-soft)]">
          {items.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(city);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[0.9rem] transition-colors hover:bg-blush-soft"
              >
                <MapPin size={15} aria-hidden="true" className="flex-none text-rose-dark" />
                <span className="font-semibold">{city.name}</span>
                <span className="text-ink-faint">{city.postCode}</span>
                {city.region ? (
                  <span className="ml-auto text-[0.78rem] text-ink-faint">
                    обл. {city.region}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function OfficePicker({
  cityId,
  selectedCode,
  onSelect,
  error,
}: {
  cityId: number | null;
  selectedCode: string;
  onSelect: (office: OfficeItem) => void;
  error?: string;
}) {
  const { items, loading, error: lookupError, search, setItems } =
    useLookup<OfficeItem>("offices");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!cityId) {
      setItems([]);
      return;
    }
    const timer = window.setTimeout(() => void search(query, cityId), 250);
    return () => window.clearTimeout(timer);
  }, [cityId, query, search, setItems]);

  if (!cityId) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-line bg-paper px-4 py-3 text-[0.86rem] text-ink-soft">
        Първо изберете населено място, за да видите офисите на Еконт.
      </p>
    );
  }

  return (
    <div>
      <Field
        label="Офис на Еконт"
        required
        error={error}
        htmlFor="ship-office-search"
      >
        <div className="relative">
          <Input
            id="ship-office-search"
            value={query}
            placeholder="Търсене по име или адрес…"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint">
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
          </span>
        </div>
      </Field>

      {lookupError ? (
        <ErrorNotice className="mt-2" title="Еконт">
          <p>{lookupError}</p>
        </ErrorNotice>
      ) : null}

      <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {items.map((office) => (
          <li key={office.code}>
            <button
              type="button"
              onClick={() => onSelect(office)}
              aria-pressed={selectedCode === office.code}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors",
                selectedCode === office.code
                  ? "border-rose-dark bg-blush-soft"
                  : "border-line bg-paper hover:border-line-strong",
              )}
            >
              {office.isAutomated ? (
                <Building2
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 flex-none text-sage"
                />
              ) : (
                <Store
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 flex-none text-rose-dark"
                />
              )}
              <span className="min-w-0">
                <span className="block text-[0.9rem] font-semibold">
                  {office.name}
                </span>
                <span className="block text-[0.79rem] text-ink-soft">
                  {office.address}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!loading && items.length === 0 ? (
          <li className="rounded-[var(--radius-sm)] border border-line bg-paper px-4 py-3 text-[0.86rem] text-ink-soft">
            Няма намерени офиси за това търсене.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function AddressFields({
  value,
  set,
  errors,
}: {
  value: ShippingDetails;
  set: (patch: Partial<ShippingDetails>) => void;
  errors: Record<string, string>;
}) {
  const { items, loading, search, setItems } = useLookup<string>("streets");
  const [streetQuery, setStreetQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value.cityId) {
      setItems([]);
      return;
    }
    const timer = window.setTimeout(
      () => void search(streetQuery, value.cityId),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [value.cityId, streetQuery, search, setItems]);

  if (!value.cityId) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-line bg-paper px-4 py-3 text-[0.86rem] text-ink-soft">
        Първо изберете населено място.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1.6fr_0.7fr]">
        <div>
          <Field
            label="Улица"
            hint="Изберете от списъка на Еконт."
            error={errors["shipping.street"]}
            htmlFor="ship-street"
          >
            <Input
              id="ship-street"
              value={value.street || streetQuery}
              placeholder="ул. / бул. …"
              autoComplete="off"
              invalid={Boolean(errors["shipping.street"])}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setStreetQuery(e.target.value);
                setOpen(true);
                if (value.street) set({ street: "" });
              }}
            />
          </Field>

          {open && items.length > 0 && !value.street ? (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-[var(--radius-sm)] border border-line bg-paper shadow-[var(--shadow-soft)]">
              {items.map((street) => (
                <li key={street}>
                  <button
                    type="button"
                    onClick={() => {
                      set({ street });
                      setStreetQuery("");
                      setOpen(false);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-[0.88rem] transition-colors hover:bg-blush-soft"
                  >
                    {street}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {loading ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] text-ink-faint">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              Зареждане на улици…
            </p>
          ) : null}
        </div>

        <Field label="Номер" htmlFor="ship-num">
          <Input
            id="ship-num"
            value={value.streetNum}
            onChange={(e) => set({ streetNum: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Квартал" htmlFor="ship-quarter">
          <Input
            id="ship-quarter"
            value={value.quarter}
            onChange={(e) => set({ quarter: e.target.value })}
          />
        </Field>
        <Field
          label="Допълнително"
          hint="Блок, вход, етаж, апартамент."
          htmlFor="ship-other"
        >
          <Input
            id="ship-other"
            value={value.other}
            onChange={(e) => set({ other: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
