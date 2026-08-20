import type { SummaryLine } from "@/features/configurator/types";

/**
 * The immutable record of what was ordered.
 *
 * Relationships still use ids, but every human-readable label is copied in at
 * submission time. Renaming „Шоколадов крем“ in the admin panel a year later
 * must not silently rewrite what an old order said.
 */
export type OrderSnapshot = {
  version: 1;
  kind: "CATALOG" | "CUSTOM";
  createdAtIso: string;

  product?: {
    id: string;
    name: string;
    slug: string;
    categoryId: string;
    categoryName: string;
    portions: string | null;
    basePriceCents: number | null;
  };

  dessert?: {
    id: string;
    name: string;
    slug: string;
    renderer: string;
    basePriceCents: number | null;
  };

  /** Human-readable configuration, in the order the customer answered it. */
  lines: { group: string; groupKey: string; value: string }[];

  quantity: number;
  estimatedPriceCents: number | null;
  priceIsEstimate: boolean;
};

export function buildCustomSnapshot(input: {
  dessert: {
    id: string;
    name: string;
    slug: string;
    renderer: string;
    basePriceCents: number | null;
  };
  summary: SummaryLine[];
  quantity: number;
  estimatedPriceCents: number | null;
}): OrderSnapshot {
  return {
    version: 1,
    kind: "CUSTOM",
    createdAtIso: new Date().toISOString(),
    dessert: input.dessert,
    lines: input.summary.map((line) => ({
      group: line.groupLabel,
      groupKey: line.groupKey,
      value: line.value,
    })),
    quantity: input.quantity,
    estimatedPriceCents: input.estimatedPriceCents,
    priceIsEstimate: true,
  };
}

export function buildCatalogSnapshot(input: {
  product: {
    id: string;
    name: string;
    slug: string;
    categoryId: string;
    categoryName: string;
    portions: string | null;
    basePriceCents: number | null;
  };
  quantity: number;
}): OrderSnapshot {
  const lines: OrderSnapshot["lines"] = [
    { group: "Продукт", groupKey: "product", value: input.product.name },
    { group: "Категория", groupKey: "category", value: input.product.categoryName },
  ];

  if (input.product.portions) {
    lines.push({
      group: "Порции",
      groupKey: "portions",
      value: input.product.portions,
    });
  }

  return {
    version: 1,
    kind: "CATALOG",
    createdAtIso: new Date().toISOString(),
    product: input.product,
    lines,
    quantity: input.quantity,
    estimatedPriceCents:
      input.product.basePriceCents === null
        ? null
        : input.product.basePriceCents * input.quantity,
    priceIsEstimate: true,
  };
}

/** Defensive read — old rows may predate a later schema change. */
export function readSnapshot(value: unknown): OrderSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<OrderSnapshot>;
  if (!Array.isArray(candidate.lines)) return null;
  if (candidate.kind !== "CATALOG" && candidate.kind !== "CUSTOM") return null;
  return candidate as OrderSnapshot;
}

/** What the order is "of", for tables and e-mail subjects. */
export function snapshotTitle(snapshot: OrderSnapshot | null): string {
  if (!snapshot) return "Поръчка";
  if (snapshot.kind === "CATALOG") return snapshot.product?.name ?? "Продукт";
  return snapshot.dessert?.name ?? "Персонален десерт";
}
