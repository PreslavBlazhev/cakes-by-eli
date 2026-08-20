"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Field, Input, OptionCard, Textarea } from "@/components/ui/form";
import {
  buildSummary,
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
 * Left column: option groups, ordered into steps, rendered entirely from
 * the data the admin panel controls. Right column: the sticky live
 * drawing with the running list of choices underneath it, so the panel
 * answers "what have I picked so far" without scrolling back up.
 *
 * Nothing here knows what a "cake" is — adding a dessert type in the
 * admin panel produces a working configurator with no code change.
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
  const summary = useMemo(
    () => buildSummary(dessert, state),
    [dessert, state],
  );

  const currentStepIndex = steps.findIndex((step) =>
    step.groups.some((group) => !hasValue(state, group)),
  );
  const activeStep = currentStepIndex === -1 ? steps.length : currentStepIndex + 1;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.72fr)] lg:items-start lg:gap-14">
      {/* ------------------------------------------- Mobile sticky preview */}
      <div className="sticky top-[72px] z-30 -mx-4 mb-2 border-y border-line bg-cream/97 px-4 py-3 backdrop-blur lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <span className="frame size-14 flex-none bg-paper">
              <DessertPreview model={model} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-[family-name:var(--font-display)] text-[1.05rem] leading-tight">
                {dessert.name}
              </span>
              <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                Стъпка {Math.min(activeStep, steps.length)} / {steps.length} ·{" "}
                {progress.answered} от {progress.total}
              </span>
              <span
                aria-hidden="true"
                className="mt-2 block h-px w-full bg-line"
              >
                <span
                  className="block h-px bg-rose-dark transition-[width] duration-500"
                  style={{
                    width:
                      progress.total === 0
                        ? "0%"
                        : `${(progress.answered / progress.total) * 100}%`,
                  }}
                />
              </span>
            </span>
            <ChevronDown
              size={17}
              aria-hidden="true"
              className="flex-none text-ink-faint transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-4 border-t border-line pt-4">
            <div className="frame mx-auto aspect-square w-full max-w-[260px] bg-paper">
              <DessertPreview model={model} />
            </div>
            {summary.length > 0 ? (
              <ChoiceList lines={summary} className="mt-4" />
            ) : null}
          </div>
        </details>
      </div>

      {/* ------------------------------------------------------ Steps */}
      <div>
        <StepRail
          steps={steps.map((step, index) => ({
            key: step.step,
            label: step.groups.map((g) => g.label).join(" · "),
            done: step.groups.every((group) => hasValue(state, group)),
            index,
          }))}
          answered={progress.answered}
          total={progress.total}
        />

        <div className="mt-10 space-y-12">
          {steps.map((step, index) => {
            const done = step.groups.every((group) => hasValue(state, group));
            return (
              <section
                key={step.step}
                id={`step-${step.step}`}
                aria-labelledby={`step-heading-${step.step}`}
                className="scroll-mt-32 border-t border-line pt-7"
              >
                <header className="mb-7 flex items-baseline gap-4">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "numeral flex-none text-[0.75rem] transition-colors",
                      done ? "text-positive" : "text-rose-dark",
                    )}
                  >
                    {done ? (
                      <Check size={14} aria-hidden="true" className="mt-1" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <h3
                    id={`step-heading-${step.step}`}
                    className="display-4 flex-1"
                  >
                    {step.groups.map((group) => group.label).join(" · ")}
                  </h3>
                </header>

                <div className="space-y-8 lg:pl-9">
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
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ Sticky preview */}
      <aside className="hidden lg:sticky lg:top-[108px] lg:block">
        <div className="border border-line bg-paper">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <span className="label label-muted">Вашият десерт</span>
            <span className="numeral text-[0.72rem] text-ink-soft">
              {progress.answered} / {progress.total}
            </span>
          </div>

          <div className="aspect-square w-full p-4">
            <DessertPreview model={model} />
          </div>

          <p className="border-t border-line px-5 py-3.5 text-center font-[family-name:var(--font-display)] text-[1.25rem]">
            {dessert.name}
          </p>

          {summary.length > 0 ? (
            <div className="border-t border-line px-5 py-4">
              <ChoiceList lines={summary} />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** The running list of what has been chosen so far. */
function ChoiceList({
  lines,
  className,
}: {
  lines: { groupKey: string; groupLabel: string; value: string }[];
  className?: string;
}) {
  return (
    <dl className={cn("space-y-0", className)}>
      {lines.map((line) => (
        <div
          key={line.groupKey}
          className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0"
        >
          <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-ink-faint">
            {line.groupLabel}
          </dt>
          <dd className="text-right text-[0.82rem] font-semibold text-ink">
            {line.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Progress as a ruled index of the steps rather than a rounded bar.
 * Each entry links to its section, so a long configuration stays
 * navigable instead of requiring a scroll hunt.
 */
function StepRail({
  steps,
  answered,
  total,
}: {
  steps: { key: number; label: string; done: boolean; index: number }[];
  answered: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : (answered / total) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="label label-muted">Стъпки</span>
        <span className="numeral text-[0.72rem] text-ink-soft">
          {answered} от {total} избора
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Напредък по конфигурацията"
        className="mt-3 h-px w-full bg-line"
      >
        <motion.div
          className="h-px bg-rose-dark"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <nav aria-label="Стъпки в конфигуратора" className="mt-4">
        <ol className="flex flex-wrap gap-x-6 gap-y-2">
          {steps.map((step) => (
            <li key={step.key}>
              <a
                href={`#step-${step.key}`}
                className={cn(
                  "link-underline flex items-baseline gap-2 text-[0.7rem] uppercase tracking-[0.12em] transition-colors",
                  step.done
                    ? "text-ink-faint hover:text-ink"
                    : "font-bold text-ink hover:text-rose-dark",
                )}
              >
                <span aria-hidden="true" className="numeral text-[0.62rem]">
                  {step.done ? "✓" : String(step.index + 1).padStart(2, "0")}
                </span>
                <span className="max-w-[16ch] truncate">{step.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
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
      <legend className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
          {group.label}
        </span>
        {group.isRequired ? (
          <span aria-hidden="true" className="text-rose-dark">
            *
          </span>
        ) : null}
        {isMulti ? (
          <span className="text-[0.7rem] normal-case tracking-normal text-ink-faint">
            (до {group.maxSelect})
          </span>
        ) : null}
      </legend>

      {group.helpText ? (
        <p className="mt-2 text-[0.78rem] leading-snug text-ink-faint">
          {group.helpText}
        </p>
      ) : null}

      <div
        role={isMulti ? "group" : "radiogroup"}
        aria-label={group.label}
        className={cn(
          "mt-3.5 grid gap-2.5",
          isSwatchGroup
            ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            : group.options.length > 4
              ? "sm:grid-cols-2"
              : "",
        )}
      >
        <AnimatePresence initial={false}>
          {group.options.map((option) => (
            <motion.div
              key={option.key}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
        <p className="mt-3 border-l-2 border-danger pl-3 text-[0.78rem] font-semibold text-danger">
          {error}
        </p>
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
