/**
 * The one list of allergens, read by the admin form and the product page.
 *
 * A product stores `code`s, never a label or a number, so renaming an allergen
 * or changing its number cannot disconnect it from the products that have it.
 * A new entry is assigned to nothing: a product only ever has the codes that
 * were ticked for it.
 *
 * `legacy` holds the labels the database stored before codes existed, matched
 * by meaning. Two of them mean the same allergen, which is how a product that
 * had both ends up with a single „Ядки“ line.
 */
export const ALLERGENS = [
  {
    code: "gluten",
    number: 1,
    label: "Зърнени култури, съдържащи глутен",
    legacy: ["Глутен"],
  },
  {
    code: "crustaceans",
    number: 2,
    label: "Ракообразни и продукти от тях",
    legacy: [],
  },
  { code: "eggs", number: 3, label: "Яйца и продукти от тях", legacy: ["Яйца"] },
  { code: "fish", number: 4, label: "Риба и рибни продукти", legacy: [] },
  {
    code: "peanuts",
    number: 5,
    label: "Фъстъци и продукти от тях",
    legacy: ["Фъстъци"],
  },
  { code: "soy", number: 6, label: "Соя и соеви продукти", legacy: ["Соя"] },
  { code: "milk", number: 7, label: "Мляко и млечни продукти", legacy: ["Мляко"] },
  {
    code: "nuts",
    number: 8,
    label: "Ядки и продукти от тях",
    legacy: ["Ядки", "Ядки от дървесни видове"],
  },
  { code: "celery", number: 9, label: "Целина и продукти от нея", legacy: [] },
  { code: "mustard", number: 10, label: "Синап и продукти от него", legacy: [] },
  {
    code: "sesame",
    number: 11,
    label: "Сусамово семе и продукти от него",
    legacy: ["Сусам"],
  },
  { code: "sulphites", number: 12, label: "Серен диоксид и сулфити", legacy: [] },
  { code: "lupin", number: 13, label: "Лупина и продукти от нея", legacy: [] },
  {
    code: "molluscs",
    number: 14,
    label: "Мекотели и продукти от тях",
    legacy: [],
  },
] as const;

export type Allergen = (typeof ALLERGENS)[number];
export type AllergenCode = Allergen["code"];

const lookupKey = (value: string) => value.trim().toLocaleLowerCase("bg");

const BY_STORED_VALUE = new Map<string, Allergen>(
  ALLERGENS.flatMap((allergen) =>
    [allergen.code, allergen.label, ...allergen.legacy].map(
      (value) => [lookupKey(value), allergen] as const,
    ),
  ),
);

/** The allergens behind stored values: known only, once each, in list order. */
export function selectedAllergens(values: readonly string[]): Allergen[] {
  const found = new Set<Allergen>();
  for (const value of values) {
    const allergen = BY_STORED_VALUE.get(lookupKey(value));
    if (allergen) found.add(allergen);
  }
  return [...found].sort((a, b) => a.number - b.number);
}

export function normalizeAllergens(values: readonly string[]): AllergenCode[] {
  return selectedAllergens(values).map((allergen) => allergen.code);
}

/**
 * What a database row should hold. Unlike `normalizeAllergens`, a value nobody
 * can interpret is kept: allergen data is not something to discard on a guess.
 */
export function canonicalStoredAllergens(values: readonly string[]): {
  stored: string[];
  unknown: string[];
} {
  const unknown = [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value && !BY_STORED_VALUE.has(lookupKey(value))),
    ),
  ];
  return { stored: [...normalizeAllergens(values), ...unknown], unknown };
}

/** „7. Мляко и млечни продукти“ */
export function formatAllergen(allergen: Allergen): string {
  return `${allergen.number}. ${allergen.label}`;
}
