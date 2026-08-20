import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  customizationGroups,
  customizationOptions,
  customizationRules,
  dessertTypes,
} from "@/db/schema";
import type {
  ConfigGroup,
  ConfigRule,
  DessertTypeConfig,
} from "@/features/configurator/types";

/**
 * Loads a dessert type together with its groups, options and rules.
 *
 * The very same shape is handed to the browser and used by the server to
 * validate a submission, so the two can never disagree about what is allowed.
 */
export async function getDessertConfig(
  slug: string,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<DessertTypeConfig | null> {
  const typeRows = await db
    .select()
    .from(dessertTypes)
    .where(
      activeOnly
        ? and(eq(dessertTypes.slug, slug), eq(dessertTypes.isActive, true))
        : eq(dessertTypes.slug, slug),
    )
    .limit(1);

  const type = typeRows[0];
  if (!type) return null;

  return hydrate(type, activeOnly);
}

export async function getDessertConfigById(
  id: string,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<DessertTypeConfig | null> {
  const typeRows = await db
    .select()
    .from(dessertTypes)
    .where(eq(dessertTypes.id, id))
    .limit(1);

  const type = typeRows[0];
  if (!type) return null;
  if (activeOnly && !type.isActive) return null;

  return hydrate(type, activeOnly);
}

async function hydrate(
  type: typeof dessertTypes.$inferSelect,
  activeOnly: boolean,
): Promise<DessertTypeConfig> {
  const groupRows = await db
    .select()
    .from(customizationGroups)
    .where(
      activeOnly
        ? and(
            eq(customizationGroups.dessertTypeId, type.id),
            eq(customizationGroups.isActive, true),
          )
        : eq(customizationGroups.dessertTypeId, type.id),
    )
    .orderBy(asc(customizationGroups.step), asc(customizationGroups.sortOrder));

  const groupIds = groupRows.map((g) => g.id);

  type OptionRow = typeof customizationOptions.$inferSelect;

  const [optionRows, ruleRows] = await Promise.all([
    groupIds.length > 0
      ? db
          .select()
          .from(customizationOptions)
          .where(
            activeOnly
              ? and(
                  inArray(customizationOptions.groupId, groupIds),
                  eq(customizationOptions.isActive, true),
                )
              : inArray(customizationOptions.groupId, groupIds),
          )
          .orderBy(asc(customizationOptions.sortOrder))
      : Promise.resolve<OptionRow[]>([]),
    db
      .select()
      .from(customizationRules)
      .where(eq(customizationRules.dessertTypeId, type.id)),
  ]);

  const optionsByGroup = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const list = optionsByGroup.get(option.groupId);
    if (list) list.push(option);
    else optionsByGroup.set(option.groupId, [option]);
  }

  const groups: ConfigGroup[] = groupRows.map((g) => ({
    id: g.id,
    key: g.key,
    label: g.label,
    helpText: g.helpText,
    inputType: g.inputType,
    isRequired: g.isRequired,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    maxLength: g.maxLength,
    placeholder: g.placeholder,
    previewChannel: g.previewChannel,
    step: g.step,
    sortOrder: g.sortOrder,
    options: (optionsByGroup.get(g.id) ?? []).map((o) => ({
      id: o.id,
      key: o.key,
      label: o.label,
      description: o.description,
      priceModifierCents: o.priceModifierCents,
      previewValue: o.previewValue,
      swatchColor: o.swatchColor,
      sortOrder: o.sortOrder,
    })),
  }));

  const rules: ConfigRule[] = ruleRows.map((r) => ({
    targetType: r.targetType,
    targetKey: r.targetKey,
    targetGroupKey: r.targetGroupKey,
    mode: r.mode,
    whenGroupKey: r.whenGroupKey,
    whenOptionKeys: r.whenOptionKeys,
  }));

  return {
    id: type.id,
    slug: type.slug,
    name: type.name,
    renderer: type.renderer,
    description: type.description,
    basePriceCents: type.basePriceCents,
    categoryId: type.categoryId,
    groups,
    rules,
  };
}

/** Lightweight list for the dessert-type picker in the custom builder. */
export async function listConfigurableDesserts() {
  return db
    .select({
      id: dessertTypes.id,
      slug: dessertTypes.slug,
      name: dessertTypes.name,
      renderer: dessertTypes.renderer,
      description: dessertTypes.description,
      basePriceCents: dessertTypes.basePriceCents,
    })
    .from(dessertTypes)
    .where(eq(dessertTypes.isActive, true))
    .orderBy(asc(dessertTypes.sortOrder), asc(dessertTypes.name));
}
