import type {
  ConfigGroup,
  ConfigOption,
  ConfigRule,
  ConfigState,
  ConfigValue,
  DessertTypeConfig,
  SummaryLine,
} from "./types";

/**
 * Pure configurator logic.
 *
 * Everything in this file is shared verbatim between the browser (to decide
 * what to render) and the server (to decide what to accept), so a customer
 * cannot submit an option that the UI would never have shown them.
 */

export function selectedKeys(state: ConfigState, groupKey: string): string[] {
  return state[groupKey]?.options ?? [];
}

function ruleMatches(rule: ConfigRule, state: ConfigState): boolean {
  const chosen = selectedKeys(state, rule.whenGroupKey);
  if (rule.whenOptionKeys.length === 0) return chosen.length > 0;
  return rule.whenOptionKeys.some((key) => chosen.includes(key));
}

/** Visible when every SHOW_WHEN rule matches and no HIDE_WHEN rule matches. */
function evaluate(rules: ConfigRule[], state: ConfigState): boolean {
  const showRules = rules.filter((r) => r.mode === "SHOW_WHEN");
  const hideRules = rules.filter((r) => r.mode === "HIDE_WHEN");

  if (showRules.some((r) => !ruleMatches(r, state))) return false;
  if (hideRules.some((r) => ruleMatches(r, state))) return false;
  return true;
}

export function isGroupVisible(
  dessert: DessertTypeConfig,
  groupKey: string,
  state: ConfigState,
): boolean {
  const rules = dessert.rules.filter(
    (r) => r.targetType === "GROUP" && r.targetKey === groupKey,
  );
  return evaluate(rules, state);
}

export function isOptionVisible(
  dessert: DessertTypeConfig,
  groupKey: string,
  optionKey: string,
  state: ConfigState,
): boolean {
  const rules = dessert.rules.filter(
    (r) =>
      r.targetType === "OPTION" &&
      r.targetKey === optionKey &&
      r.targetGroupKey === groupKey,
  );
  return evaluate(rules, state);
}

export function visibleGroups(
  dessert: DessertTypeConfig,
  state: ConfigState,
): ConfigGroup[] {
  return dessert.groups
    .filter((g) => isGroupVisible(dessert, g.key, state))
    .map((g) => ({
      ...g,
      options: g.options.filter((o) =>
        isOptionVisible(dessert, g.key, o.key, state),
      ),
    }));
}

/** Ordered list of wizard steps that currently have something to show. */
export function visibleSteps(
  dessert: DessertTypeConfig,
  state: ConfigState,
): { step: number; groups: ConfigGroup[] }[] {
  const groups = visibleGroups(dessert, state);
  const steps = new Map<number, ConfigGroup[]>();

  for (const group of groups) {
    const bucket = steps.get(group.step);
    if (bucket) bucket.push(group);
    else steps.set(group.step, [group]);
  }

  return [...steps.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, list]) => ({
      step,
      groups: list.sort((a, b) => a.sortOrder - b.sortOrder),
    }));
}

/**
 * Drops selections that are no longer reachable after a change, so hiding a
 * group can never leave an orphaned value behind in the submitted payload.
 */
export function pruneState(
  dessert: DessertTypeConfig,
  state: ConfigState,
): ConfigState {
  // Two passes settle the common case where hiding a group also hides options
  // in a group that depended on it.
  let current = state;

  for (let pass = 0; pass < 3; pass += 1) {
    const next: ConfigState = {};
    let changed = false;

    for (const group of dessert.groups) {
      if (!isGroupVisible(dessert, group.key, current)) {
        if (current[group.key]) changed = true;
        continue;
      }

      const value = current[group.key];
      if (!value) continue;

      if (group.inputType === "SINGLE" || group.inputType === "MULTI") {
        const keep = (value.options ?? []).filter(
          (key) =>
            group.options.some((o) => o.key === key) &&
            isOptionVisible(dessert, group.key, key, current),
        );
        if (keep.length !== (value.options ?? []).length) changed = true;
        if (keep.length > 0) next[group.key] = { options: keep };
      } else {
        next[group.key] = value;
      }
    }

    current = next;
    if (!changed) break;
  }

  return current;
}

export function findGroup(
  dessert: DessertTypeConfig,
  groupKey: string,
): ConfigGroup | undefined {
  return dessert.groups.find((g) => g.key === groupKey);
}

export function findOption(
  group: ConfigGroup,
  optionKey: string,
): ConfigOption | undefined {
  return group.options.find((o) => o.key === optionKey);
}

/* ------------------------------------------------------------------ *
 * Selection helpers used by the UI
 * ------------------------------------------------------------------ */

export function toggleOption(
  dessert: DessertTypeConfig,
  state: ConfigState,
  groupKey: string,
  optionKey: string,
): ConfigState {
  const group = findGroup(dessert, groupKey);
  if (!group) return state;

  const current = selectedKeys(state, groupKey);
  let nextKeys: string[];

  if (group.inputType === "SINGLE") {
    nextKeys =
      current[0] === optionKey && !group.isRequired ? [] : [optionKey];
  } else {
    if (current.includes(optionKey)) {
      nextKeys = current.filter((k) => k !== optionKey);
    } else if (current.length >= group.maxSelect) {
      // Replace the oldest pick rather than silently ignoring the tap.
      nextKeys = [...current.slice(1), optionKey];
    } else {
      nextKeys = [...current, optionKey];
    }
  }

  const next: ConfigState = { ...state, [groupKey]: { options: nextKeys } };
  if (nextKeys.length === 0) delete next[groupKey];

  return pruneState(dessert, next);
}

export function setTextValue(
  state: ConfigState,
  groupKey: string,
  text: string,
): ConfigState {
  const next = { ...state };
  if (text.trim().length === 0) delete next[groupKey];
  else next[groupKey] = { text };
  return next;
}

export function setNumberValue(
  state: ConfigState,
  groupKey: string,
  value: number | null,
): ConfigState {
  const next = { ...state };
  if (value === null || !Number.isFinite(value)) delete next[groupKey];
  else next[groupKey] = { number: value };
  return next;
}

/* ------------------------------------------------------------------ *
 * Completeness, summary and price
 * ------------------------------------------------------------------ */

export type ValidationIssue = { groupKey: string; message: string };

export function validateState(
  dessert: DessertTypeConfig,
  state: ConfigState,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const groups = visibleGroups(dessert, state);

  for (const group of groups) {
    const value: ConfigValue | undefined = state[group.key];

    if (group.inputType === "SINGLE" || group.inputType === "MULTI") {
      const keys = value?.options ?? [];
      const unknown = keys.filter((k) => !group.options.some((o) => o.key === k));
      if (unknown.length > 0) {
        issues.push({
          groupKey: group.key,
          message: `Невалиден избор в „${group.label}“.`,
        });
        continue;
      }
      if (group.isRequired && keys.length === 0) {
        issues.push({
          groupKey: group.key,
          message: `Моля, изберете „${group.label}“.`,
        });
      }
      if (keys.length > group.maxSelect) {
        issues.push({
          groupKey: group.key,
          message: `В „${group.label}“ може да изберете най-много ${group.maxSelect}.`,
        });
      }
      if (keys.length > 0 && keys.length < group.minSelect) {
        issues.push({
          groupKey: group.key,
          message: `В „${group.label}“ изберете поне ${group.minSelect}.`,
        });
      }
    }

    if (group.inputType === "TEXT") {
      const text = value?.text ?? "";
      if (group.isRequired && text.trim().length === 0) {
        issues.push({
          groupKey: group.key,
          message: `Моля, попълнете „${group.label}“.`,
        });
      }
      if (group.maxLength && text.length > group.maxLength) {
        issues.push({
          groupKey: group.key,
          message: `„${group.label}“ може да е до ${group.maxLength} знака.`,
        });
      }
    }

    if (group.inputType === "NUMBER") {
      const num = value?.number;
      if (group.isRequired && (num === undefined || num === null)) {
        issues.push({
          groupKey: group.key,
          message: `Моля, попълнете „${group.label}“.`,
        });
      }
      if (num !== undefined && (!Number.isFinite(num) || num <= 0)) {
        issues.push({
          groupKey: group.key,
          message: `„${group.label}“ трябва да е положително число.`,
        });
      }
    }
  }

  // Anything left in state that is not a currently visible group is a
  // tampered or stale payload.
  const visibleKeys = new Set(groups.map((g) => g.key));
  for (const key of Object.keys(state)) {
    if (!visibleKeys.has(key)) {
      issues.push({
        groupKey: key,
        message: "Изборът съдържа опция, която не е налична за този десерт.",
      });
    }
  }

  return issues;
}

export function buildSummary(
  dessert: DessertTypeConfig,
  state: ConfigState,
): SummaryLine[] {
  const lines: SummaryLine[] = [];

  for (const group of visibleGroups(dessert, state)) {
    const value = state[group.key];
    if (!value) continue;

    if (group.inputType === "TEXT") {
      const text = value.text?.trim();
      if (!text) continue;
      lines.push({
        groupKey: group.key,
        groupLabel: group.label,
        value: text,
        optionKeys: [],
        priceCents: null,
      });
      continue;
    }

    if (group.inputType === "NUMBER") {
      if (value.number === undefined) continue;
      lines.push({
        groupKey: group.key,
        groupLabel: group.label,
        value: String(value.number),
        optionKeys: [],
        priceCents: null,
      });
      continue;
    }

    const options = (value.options ?? [])
      .map((key) => findOption(group, key))
      .filter((o): o is ConfigOption => Boolean(o));
    if (options.length === 0) continue;

    const priced = options.filter((o) => o.priceModifierCents !== null);
    lines.push({
      groupKey: group.key,
      groupLabel: group.label,
      value: options.map((o) => o.label).join(", "),
      optionKeys: options.map((o) => o.key),
      priceCents:
        priced.length > 0
          ? priced.reduce((sum, o) => sum + (o.priceModifierCents ?? 0), 0)
          : null,
    });
  }

  return lines;
}

export type PriceEstimate = {
  /** Null whenever pricing is not fully configured — never guessed. */
  totalCents: number | null;
  /** True when every chosen option carries a configured modifier. */
  complete: boolean;
};

/**
 * Only produces a number when the base price and every selected option have a
 * configured price. A partially priced catalogue must show
 * „Цена след уточнение“ rather than a misleading total.
 */
export function estimatePrice(
  dessert: DessertTypeConfig,
  state: ConfigState,
  quantity = 1,
): PriceEstimate {
  if (dessert.basePriceCents === null) {
    return { totalCents: null, complete: false };
  }

  let total = dessert.basePriceCents;
  let complete = true;

  for (const group of visibleGroups(dessert, state)) {
    for (const key of selectedKeys(state, group.key)) {
      const option = findOption(group, key);
      if (!option) continue;
      if (option.priceModifierCents === null) complete = false;
      else total += option.priceModifierCents;
    }
  }

  if (!complete) return { totalCents: null, complete: false };
  return { totalCents: total * Math.max(1, quantity), complete: true };
}

/** Progress for the stepper: how many visible groups have a value. */
export function completionProgress(
  dessert: DessertTypeConfig,
  state: ConfigState,
): { answered: number; total: number } {
  const groups = visibleGroups(dessert, state);
  const answered = groups.filter((g) => {
    const value = state[g.key];
    if (!value) return false;
    if (g.inputType === "TEXT") return Boolean(value.text?.trim());
    if (g.inputType === "NUMBER") return value.number !== undefined;
    return (value.options ?? []).length > 0;
  }).length;
  return { answered, total: groups.length };
}

/** Applies each group's default (first option) where the group is required. */
export function withDefaults(dessert: DessertTypeConfig): ConfigState {
  let state: ConfigState = {};

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const group of visibleGroups(dessert, state)) {
      if (state[group.key]) continue;
      if (!group.isRequired) continue;
      if (group.inputType !== "SINGLE") continue;
      const first = group.options[0];
      if (!first) continue;
      state = { ...state, [group.key]: { options: [first.key] } };
      changed = true;
    }
    if (!changed) break;
  }

  return state;
}
