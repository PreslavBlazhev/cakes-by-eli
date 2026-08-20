"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Field, Input, OptionCard, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import {
  completionProgress,
  setNumberValue,
  setTextValue,
  toggleOption,
  visibleSteps,
} from "@/features/configurator/rules";
import type {
  ConfigGroup,
  ConfigState,
  DessertTypeConfig,
} from "@/features/configurator/types";
import { buildPreviewModel } from "@/features/configurator/preview/model";
import { DessertPreview } from "@/features/configurator/preview/DessertPreview";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

/**
 * The signature ordering surface.
 *
 * Left column: option groups, ordered into steps, rendered entirely from the
 * data the admin panel controls. Right column: the sticky live preview.
 * Nothing here knows what a "cake" is — adding a dessert type in the admin
 * panel produces a working configurator with no code change.
 */
export function CustomBuilder({
  dessert,
  state,
  onChange,
  errors,
}: {
  dessert: DessertTypeConfig;
  state: ConfigState;
  onChange: (next: ConfigState) => void;
  errors: Record<string, string>;
}) {
  const steps = useMemo(() => visibleSteps(dessert, state), [dessert, state]);
  const progress = useMemo(
    () => completionProgress(dessert, state),
    [dessert, state],
  );
  const model = useMemo(
    () => buildPreviewModel(dessert, state),
    [dessert, state],
  );

  const currentStepIndex = steps.findIndex((step) =>
    step.groups.some((group) => !hasValue(state, group)),
  );
  const activeStep = currentStepIndex === -1 ? steps.length : currentStepIndex + 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)] lg:items-start">
      {/* ------------------------------------------- Mobile sticky preview */}
      <div className="sticky top-[74px] z-30 -mx-4 mb-2 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <span className="size-16 flex-none overflow-hidden rounded-[var(--radius-xs)] border border-line bg-paper">
              <DessertPreview model={model} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                Вашият десерт
              </span>
              <span className="block truncate text-[0.94rem] font-bold">
                {dessert.name}
              </span>
              <span className="block text-[0.76rem] text-ink-soft">
                Стъпка {Math.min(activeStep, steps.length)} от {steps.length} ·{" "}
                {progress.answered}/{progress.total} избора
              </span>
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="flex-none text-ink-soft transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-3 rounded-[var(--radius-md)] border border-line bg-paper p-3">
            <div className="aspect-square w-full max-w-[280px] mx-auto">
              <DessertPreview model={model} />
            </div>
          </div>
        </details>
      </div>

      {/* ---------------------------------------------------- Left column */}
      <div>
        <ProgressBar
          current={Math.min(activeStep, steps.length)}
          total={steps.length}
          answered={progress.answered}
          totalGroups={progress.total}
        />

        <div className="mt-6 space-y-7">
          {steps.map((step, index) => (
            <section
              key={step.step}
              aria-labelledby={`step-${step.step}`}
              className="panel p-5 sm:p-6"
            >
              <header className="mb-5 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 flex-none place-items-center rounded-full text-[0.9rem] font-bold transition-colors",
                    step.groups.every((group) => hasValue(state, group))
                      ? "bg-positive text-paper"
                      : "bg-ink text-paper",
                  )}
                >
                  {step.groups.every((group) => hasValue(state, group)) ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <h3
                  id={`step-${step.step}`}
                  className="font-[family-name:var(--font-display)] text-[1.35rem] leading-tight"
                >
                  {step.groups.map((group) => group.label).join(" · ")}
                </h3>
              </header>

              <div className="space-y-6">
                {step.groups.map((group) => (
                  <GroupControl
                    key={group.key}
                    dessert={dessert}
                    group={group}
                    state={state}
                    onChange={onChange}
                    error={errors[`config.${group.key}`]}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------- Right column */}
      <aside className="hidden lg:block lg:sticky lg:top-[110px]">
        <div className="panel overflow-hidden bg-gradient-to-b from-blush-soft to-paper p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow eyebrow-plain text-[0.68rem]">
              Вашият десерт
            </span>
            <Badge tone="rose">
              {progress.answered}/{progress.total}
            </Badge>
          </div>

          <div className="mt-3 aspect-square w-full">
            <DessertPreview model={model} />
          </div>

          <p className="mt-1 text-center font-[family-name:var(--font-display)] text-[1.4rem]">
            {dessert.name}
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProgressBar({
  current,
  total,
  answered,
  totalGroups,
}: {
  current: number;
  total: number;
  answered: number;
  totalGroups: number;
}) {
  const percent = totalGroups === 0 ? 0 : (answered / totalGroups) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.86rem] font-bold">
          Стъпка {Math.max(1, current)} от {Math.max(1, total)}
        </p>
        <p className="text-[0.8rem] text-ink-soft">
          {answered} от {totalGroups} избора
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Напредък по конфигурацията"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <motion.div
          className="h-full rounded-full bg-rose-dark"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function GroupControl({
  dessert,
  group,
  state,
  onChange,
  error,
}: {
  dessert: DessertTypeConfig;
  group: ConfigGroup;
  state: ConfigState;
  onChange: (next: ConfigState) => void;
  error?: string;
}) {
  const value = state[group.key];
  const selected = value?.options ?? [];
  const isMulti = group.inputType === "MULTI";

  if (group.inputType === "TEXT") {
    const text = value?.text ?? "";
    return (
      <Field
        label={group.label}
        hint={
          group.maxLength
            ? `${group.helpText ? `${group.helpText} ` : ""}${text.length}/${group.maxLength} знака`
            : group.helpText
        }
        error={error}
        required={group.isRequired}
        htmlFor={`group-${group.key}`}
      >
        {group.maxLength && group.maxLength > 60 ? (
          <Textarea
            id={`group-${group.key}`}
            value={text}
            maxLength={group.maxLength}
            placeholder={group.placeholder}
            invalid={Boolean(error)}
            onChange={(e) => onChange(setTextValue(state, group.key, e.target.value))}
          />
        ) : (
          <Input
            id={`group-${group.key}`}
            value={text}
            maxLength={group.maxLength ?? undefined}
            placeholder={group.placeholder}
            invalid={Boolean(error)}
            onChange={(e) => onChange(setTextValue(state, group.key, e.target.value))}
          />
        )}
      </Field>
    );
  }

  if (group.inputType === "NUMBER") {
    return (
      <Field
        label={group.label}
        hint={group.helpText}
        error={error}
        required={group.isRequired}
        htmlFor={`group-${group.key}`}
      >
        <Input
          id={`group-${group.key}`}
          type="number"
          min={1}
          inputMode="numeric"
          value={value?.number ?? ""}
          placeholder={group.placeholder}
          invalid={Boolean(error)}
          onChange={(e) =>
            onChange(
              setNumberValue(
                state,
                group.key,
                e.target.value === "" ? null : Number(e.target.value),
              ),
            )
          }
        />
      </Field>
    );
  }

  const isSwatchGroup = group.options.some((option) => option.swatchColor);

  return (
    <fieldset>
      <legend className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[0.79rem] font-extrabold tracking-[0.02em] text-ink-soft">
        {group.label}
        {group.isRequired ? <span className="text-rose-dark">*</span> : null}
        {isMulti ? (
          <span className="font-semibold normal-case text-ink-faint">
            (до {group.maxSelect})
          </span>
        ) : null}
      </legend>

      {group.helpText ? (
        <p className="mt-1 text-[0.76rem] text-ink-faint">{group.helpText}</p>
      ) : null}

      <div
        role={isMulti ? "group" : "radiogroup"}
        aria-label={group.label}
        className={cn(
          "mt-2.5 grid gap-2",
          isSwatchGroup
            ? "grid-cols-2 sm:grid-cols-3"
            : group.options.length > 6
              ? "sm:grid-cols-2"
              : "",
        )}
      >
        <AnimatePresence initial={false}>
          {group.options.map((option) => (
            <motion.div
              key={option.key}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              <OptionCard
                selected={selected.includes(option.key)}
                multi={isMulti}
                title={option.label}
                description={option.description || undefined}
                swatch={option.swatchColor}
                price={
                  option.priceModifierCents
                    ? `+${formatPrice(option.priceModifierCents)}`
                    : null
                }
                onSelect={() =>
                  onChange(toggleOption(dessert, state, group.key, option.key))
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error ? (
        <p className="mt-2 text-[0.78rem] font-semibold text-danger">{error}</p>
      ) : null}
    </fieldset>
  );
}

function hasValue(state: ConfigState, group: ConfigGroup): boolean {
  const value = state[group.key];
  if (!value) return !group.isRequired;
  if (group.inputType === "TEXT") return Boolean(value.text?.trim());
  if (group.inputType === "NUMBER") return value.number !== undefined;
  return (value.options ?? []).length > 0;
}
