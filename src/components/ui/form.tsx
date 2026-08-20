"use client";

import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3.5 py-3 " +
  "text-ink outline-none transition-[border-color,box-shadow] duration-200 " +
  "placeholder:text-ink-faint " +
  "focus:border-rose focus:ring-[3px] focus:ring-rose/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:text-ink-faint " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

/* ------------------------------------------------------------------ *
 * Field wrapper
 * ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-[0.79rem] font-extrabold tracking-[0.02em] text-ink-soft"
        >
          {label}
          {required ? <span className="ml-1 text-rose-dark">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p className="text-[0.76rem] leading-snug text-ink-faint">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-[0.78rem] font-semibold text-danger">{error}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, className)}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-30 resize-y", className)}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "appearance-none pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236f5b53' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
      }}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  id,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        {...props}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-[18px] flex-none cursor-pointer accent-[var(--color-rose-dark)]"
      />
      <label htmlFor={inputId} className="cursor-pointer text-[0.88rem] leading-snug">
        <span className="text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[0.78rem] text-ink-soft">
            {description}
          </span>
        ) : null}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Selectable cards — the configurator's main input
 * ------------------------------------------------------------------ */

export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  swatch,
  price,
  multi,
  disabled,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  swatch?: string | null;
  price?: string | null;
  multi?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-rose-dark bg-blush-soft shadow-[0_6px_18px_rgba(143,78,93,0.13)]"
          : "border-line bg-paper hover:border-line-strong hover:bg-[#fffaf3]",
        className,
      )}
    >
      {swatch ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-7 flex-none rounded-full border transition-transform duration-200",
            selected ? "border-rose-dark scale-105" : "border-line",
          )}
          style={{ background: swatch }}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-[18px] flex-none items-center justify-center border transition-colors duration-200",
            multi ? "rounded-[5px]" : "rounded-full",
            selected
              ? "border-rose-dark bg-rose-dark"
              : "border-line-strong bg-paper",
          )}
        >
          {selected ? (
            <span
              className={cn(
                "bg-paper",
                multi ? "size-2 rounded-[1px]" : "size-1.5 rounded-full",
              )}
            />
          ) : null}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[0.92rem] font-semibold leading-snug",
            selected ? "text-rose-deep" : "text-ink",
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[0.78rem] leading-snug text-ink-soft">
            {description}
          </span>
        ) : null}
      </span>

      {price ? (
        <span className="flex-none text-[0.78rem] font-bold text-ink-soft">
          {price}
        </span>
      ) : null}
    </button>
  );
}

/** Large, illustrated choice used for the two order modes. */
export function ChoiceCard({
  selected,
  onSelect,
  eyebrow,
  title,
  description,
  illustration,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  eyebrow?: string;
  title: string;
  description: string;
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border p-6 text-left transition-all duration-300",
        selected
          ? "border-rose-dark bg-paper shadow-[var(--shadow-card)]"
          : "border-line bg-paper/70 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {illustration ? (
        <div className="mb-4 flex justify-center">{illustration}</div>
      ) : null}
      {eyebrow ? (
        <span className="eyebrow eyebrow-plain mb-2 text-[0.7rem]">
          {eyebrow}
        </span>
      ) : null}
      <span className="display-3 block">{title}</span>
      <span className="mt-2 block text-[0.9rem] leading-relaxed text-ink-soft">
        {description}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "mt-5 inline-flex items-center gap-2 text-[0.85rem] font-bold transition-colors",
          selected ? "text-rose-deep" : "text-ink-soft group-hover:text-rose-dark",
        )}
      >
        {selected ? "Избрано" : "Избери"}
        <span aria-hidden="true">→</span>
      </span>
    </button>
  );
}
