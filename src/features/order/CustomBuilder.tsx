"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";

import { Field, Input, OptionCard, Textarea } from "@/components/ui/form";
import {
  buildSummary,
  clampDetailCount,
  completionProgress,
  optionDetail,
  setNumberValue,
  setOptionDetail,
  setTextValue,
  supportsOptionDetail,
  tierLabel,
  toggleOption,
  visibleSteps,
} from "@/features/configurator/rules";
import {
  DETAIL_COUNT_MAX,
  DETAIL_COUNT_MIN,
} from "@/features/configurator/types";
import type {
  ConfigGroup,
  ConfigOption,
  ConfigState,
  DessertTypeConfig,
  OptionDetail,
} from "@/features/configurator/types";
import {
  buildPreviewModel,
  channelValue,
} from "@/features/configurator/preview/model";
import type { PreviewModel } from "@/features/configurator/preview/model";
import {
  DENSITY_COUNT,
  isDensity,
} from "@/features/configurator/preview/placement";
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

  // How many tiers the cake currently has, so the tier picker only offers
  // the ones that exist. Read from the preview model, which already resolves
  // the channel, rather than by hunting for a group named "tiers".
  const tierCount = Math.max(
    1,
    Math.min(3, Number(channelValue(model, "tiers", "1")) || 1),
  );
  const rawDensity = channelValue(model, "decorDensity", "medium");
  const fallbackCount =
    DENSITY_COUNT[isDensity(rawDensity) ? rawDensity : "medium"];

  const currentStepIndex = steps.findIndex((step) =>
    step.groups.some((group) => !hasValue(state, group)),
  );
  const activeStep = currentStepIndex === -1 ? steps.length : currentStepIndex + 1;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.78fr)] lg:items-start lg:gap-14">
      {/* ------------------------------------------- Mobile sticky preview */}
      <div className="sticky top-[72px] z-30 -mx-4 mb-2 border-y border-line bg-cream px-4 py-3 lg:hidden">
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
          <div className="mt-4 border-t border-line pt-2">
            <ViewPair model={model} />
            {summary.length > 0 ? (
              <ChoiceList lines={summary} className="mt-3" />
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
                      tierCount={tierCount}
                      fallbackCount={fallbackCount}
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

          <ViewPair model={model} />

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

/**
 * The dessert from two angles at once.
 *
 * The elevation can only ever draw the half facing the viewer, so a customer
 * arranging fruit around a cake had no way to check the back. Showing the plan
 * view beside it turns "where did my blueberries go" into something you can
 * simply look at — both drawings are generated from the same placement data,
 * so they can never disagree.
 */
function ViewPair({ model }: { model: PreviewModel }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-line">
      {(
        [
          ["side", "Отстрани"],
          ["top", "Отгоре"],
        ] as const
      ).map(([view, label]) => (
        <figure key={view} className="px-2 pb-2 pt-3">
          <div className="aspect-square w-full">
            <DessertPreview model={model} view={view} />
          </div>
          <figcaption className="mt-1 text-center text-[0.6rem] uppercase tracking-[0.18em] text-ink-faint">
            {label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

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
  tierCount,
  fallbackCount,
}: {
  dessert: DessertTypeConfig;
  group: ConfigGroup;
  state: ConfigState;
  onChange: (next: ConfigState) => void;
  error?: string;
  tierCount: number;
  fallbackCount: number;
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

  const hasDetail = supportsOptionDetail(group);
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
              {hasDetail ? (
                <DecorationCard
                  option={option}
                  selected={selected.includes(option.key)}
                  detail={optionDetail(state, group.key, option.key)}
                  tierCount={tierCount}
                  fallbackCount={fallbackCount}
                  onToggle={() =>
                    onChange(toggleOption(dessert, state, group.key, option.key))
                  }
                  onDetail={(patch) =>
                    onChange(
                      setOptionDetail(state, group.key, option.key, patch),
                    )
                  }
                />
              ) : (
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
              )}
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

/**
 * A decoration, with its own number and tier.
 *
 * Once chosen, the card stops being a yes/no answer: the label restates the
 * whole decision — "Малини · 17 бр. · среден етаж" — and the two controls that
 * produced it sit underneath. They are siblings of the toggle rather than
 * children of it, because a button inside a button is neither valid HTML nor
 * operable from the keyboard.
 */
function DecorationCard({
  option,
  selected,
  detail,
  tierCount,
  fallbackCount,
  onToggle,
  onDetail,
}: {
  option: ConfigOption;
  selected: boolean;
  detail: OptionDetail;
  tierCount: number;
  fallbackCount: number;
  onToggle: () => void;
  onDetail: (patch: OptionDetail) => void;
}) {
  const count = detail.count ?? fallbackCount;
  const tier = detail.tier ?? 0;
  const inputId = `decor-${option.key}-count`;

  const summary = selected
    ? [`${count} бр.`, tierCount > 1 ? tierLabel(tier, tierCount) : null]
        .filter(Boolean)
        .join(" · ")
    : option.description || "";

  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border transition-[border-color,background-color] duration-200",
        selected ? "border-rose-dark bg-blush-soft" : "border-line bg-paper",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={onToggle}
        className="relative flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-[3px] rounded-l-[2px] transition-colors duration-200",
            selected ? "bg-rose-dark" : "bg-transparent",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex size-[18px] flex-none items-center justify-center rounded-[2px] border transition-colors duration-200",
            selected
              ? "border-rose-dark bg-rose-dark"
              : "border-line-strong bg-paper",
          )}
        >
          {selected ? <span className="size-2 rounded-[1px] bg-paper" /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[0.9rem] leading-snug",
              selected ? "font-bold text-rose-deep" : "font-semibold text-ink",
            )}
          >
            {option.label}
          </span>
          {summary ? (
            <span
              className={cn(
                "mt-0.5 block text-[0.76rem] leading-snug",
                selected ? "font-semibold text-rose-dark" : "text-ink-soft",
              )}
            >
              {summary}
            </span>
          ) : null}
        </span>

        {option.priceModifierCents ? (
          <span className="numeral flex-none text-[0.76rem] font-bold text-ink-soft">
            +{formatPrice(option.priceModifierCents)}
          </span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {selected ? (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-rose-dark/20 px-4 py-3.5">
              {/* ------------------------------------------------ Count */}
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={inputId}
                  className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink-faint"
                >
                  Брой
                </label>
                <div className="flex items-center gap-1">
                  <Stepper
                    label={`Намали броя: ${option.label}`}
                    disabled={count <= DETAIL_COUNT_MIN}
                    onClick={() =>
                      onDetail({ count: clampDetailCount(count - 1) })
                    }
                  >
                    <Minus size={13} aria-hidden="true" />
                  </Stepper>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={DETAIL_COUNT_MIN}
                    max={DETAIL_COUNT_MAX}
                    value={count}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (event.target.value === "" || !Number.isFinite(next)) {
                        return;
                      }
                      onDetail({ count: clampDetailCount(next) });
                    }}
                    aria-label={`Брой: ${option.label}`}
                    className="numeral w-14 rounded-[2px] border border-line bg-paper px-2 py-1.5 text-center text-[0.86rem] font-bold outline-none focus:border-rose-dark"
                  />
                  <Stepper
                    label={`Увеличи броя: ${option.label}`}
                    disabled={count >= DETAIL_COUNT_MAX}
                    onClick={() =>
                      onDetail({ count: clampDetailCount(count + 1) })
                    }
                  >
                    <Plus size={13} aria-hidden="true" />
                  </Stepper>
                </div>
              </div>

              {/* ------------------------------------------------- Tier */}
              {tierCount > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    id={`decor-${option.key}-tier`}
                    className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink-faint"
                  >
                    Етаж
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby={`decor-${option.key}-tier`}
                    className="flex flex-wrap gap-1"
                  >
                    {[
                      0,
                      ...Array.from({ length: tierCount }, (_, i) => i + 1),
                    ].map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={tier === value}
                        onClick={() => onDetail({ tier: value })}
                        className={cn(
                          "min-h-8 rounded-[2px] border px-2.5 text-[0.74rem] font-semibold transition-colors",
                          tier === value
                            ? "border-rose-dark bg-rose-dark text-paper"
                            : "border-line bg-paper text-ink-soft hover:border-line-strong",
                        )}
                      >
                        {value === 0 ? "Всички" : value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-[2px] border border-line bg-paper text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function hasValue(state: ConfigState, group: ConfigGroup): boolean {
  const value = state[group.key];
  if (!value) return !group.isRequired;
  if (group.inputType === "TEXT") return Boolean(value.text?.trim());
  if (group.inputType === "NUMBER") return value.number !== undefined;
  return (value.options ?? []).length > 0;
}
