export type ConfigInputType = "SINGLE" | "MULTI" | "TEXT" | "NUMBER";

export type ConfigOption = {
  id: string;
  key: string;
  label: string;
  description: string;
  priceModifierCents: number | null;
  /** Token the SVG renderer understands, e.g. "heart" or "#f3e7d8". */
  previewValue: string;
  swatchColor: string | null;
  sortOrder: number;
};

export type ConfigGroup = {
  id: string;
  key: string;
  label: string;
  helpText: string;
  inputType: ConfigInputType;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  maxLength: number | null;
  placeholder: string;
  previewChannel: string;
  step: number;
  sortOrder: number;
  options: ConfigOption[];
};

export type ConfigRule = {
  targetType: "GROUP" | "OPTION";
  targetKey: string;
  targetGroupKey: string | null;
  mode: "SHOW_WHEN" | "HIDE_WHEN";
  whenGroupKey: string;
  whenOptionKeys: string[];
};

export type DessertTypeConfig = {
  id: string;
  slug: string;
  name: string;
  /** Which preview component to mount. */
  renderer: string;
  description: string;
  basePriceCents: number | null;
  categoryId: string | null;
  groups: ConfigGroup[];
  rules: ConfigRule[];
};

/** One group's current value. Only the field matching `inputType` is used. */
export type ConfigValue = {
  options?: string[];
  text?: string;
  number?: number;
};

export type ConfigState = Record<string, ConfigValue>;

export type SummaryLine = {
  groupKey: string;
  groupLabel: string;
  /** Human readable value, already localised — this is what gets snapshotted. */
  value: string;
  optionKeys: string[];
  priceCents: number | null;
};
