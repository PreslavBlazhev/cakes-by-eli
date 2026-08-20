"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
  ORDER_TYPE_LABELS,
} from "@/lib/labels";

/** Filters keep their state in the URL so a view can be bookmarked or shared. */
export function OrderFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const query = next.toString();
    router.push(query ? `/admin/orders?${query}` : "/admin/orders");
  };

  const activeStatus = params.get("status");
  const hasFilters = [...params.keys()].some((key) => key !== "page");

  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-paper p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: search || null });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="min-w-[220px] flex-1">
          <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
            Търсене
          </span>
          <span className="relative block">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Номер, име, телефон, имейл…"
              className="pr-10"
            />
            <button
              type="submit"
              aria-label="Търси"
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-sunk"
            >
              <Search size={15} aria-hidden="true" />
            </button>
          </span>
        </label>

        <label className="min-w-[160px]">
          <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
            Тип
          </span>
          <Select
            value={params.get("type") ?? ""}
            onChange={(event) => apply({ type: event.target.value || null })}
          >
            <option value="">Всички</option>
            {Object.entries(ORDER_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-[180px]">
          <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
            Получаване
          </span>
          <Select
            value={params.get("method") ?? ""}
            onChange={(event) => apply({ method: event.target.value || null })}
          >
            <option value="">Всички</option>
            {Object.entries(FULFILLMENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-[150px]">
          <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
            Дата от
          </span>
          <Input
            type="date"
            value={params.get("from") ?? ""}
            onChange={(event) => apply({ from: event.target.value || null })}
          />
        </label>

        <label className="min-w-[150px]">
          <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
            Дата до
          </span>
          <Input
            type="date"
            value={params.get("to") ?? ""}
            onChange={(event) => apply({ to: event.target.value || null })}
          />
        </label>

        <label className="min-w-[170px]">
          <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
            Подредба
          </span>
          <Select
            value={params.get("sort") ?? "created_desc"}
            onChange={(event) => apply({ sort: event.target.value })}
          >
            <option value="created_desc">Най-нови първо</option>
            <option value="created_asc">Най-стари първо</option>
            <option value="fulfillment_asc">По дата на изпълнение</option>
          </Select>
        </label>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <Chip
          active={!activeStatus}
          onClick={() => apply({ status: null })}
        >
          Всички статуси
        </Chip>
        {ORDER_STATUS_ORDER.map((status) => (
          <Chip
            key={status}
            active={activeStatus === status}
            onClick={() => apply({ status })}
          >
            {ORDER_STATUS_LABELS[status]}
          </Chip>
        ))}

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              router.push("/admin/orders");
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-semibold text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink"
          >
            <X size={13} aria-hidden="true" />
            Изчисти филтрите
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
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
        "inline-flex min-h-8 items-center rounded-full border px-3 text-[0.78rem] font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-paper text-ink-soft hover:border-ink hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
