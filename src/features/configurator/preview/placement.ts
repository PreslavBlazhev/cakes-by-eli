import { outlineOffset, planAspect, snap } from "./geometry";
import type { CakeShape, TierGeometry } from "./geometry";

/**
 * Where every decoration sits — resolved once, drawn from two viewpoints.
 *
 * Two properties matter, and both are structural rather than cosmetic:
 *
 * 1. **Symmetry.** Every decoration is laid out with exact n-fold rotational
 *    symmetry — seventeen raspberries land at exactly 360°/17 apart. Nothing
 *    here is random and nothing is nudged "to look natural": an iced cake is
 *    judged on whether the fruit is evenly spaced, so the drawing has to
 *    promise what the kitchen will actually deliver.
 *
 * 2. **One source of truth.** A slot is described in the cake's own
 *    cylindrical coordinates — which tier, which way round, how far from the
 *    axis — and each view projects that description its own way. The raspberry
 *    hidden behind the cake in elevation is the same raspberry visible at the
 *    back of the plan view.
 */
export type Surface = "top" | "side";

export type PlacementSlot = {
  /** Stable key for React and for the animation identity. */
  id: string;
  /** Which decoration token occupies this slot. */
  token: string;
  /** Index into the tier stack; 0 is the bottom tier. */
  tier: number;
  /** Radians around the cake's axis. 0 faces the viewer in the side view. */
  angle: number;
  /** 0 = on the axis, 1 = at the rim. */
  radius: number;
  /** Whether the item rests on a top surface or clings to a tier wall. */
  surface: Surface;
  /** Size multiplier, shrunk automatically as a ring gets crowded. */
  scale: number;
  /** Draw order — later items sit in front. */
  order: number;
};

/** What the customer asked for, per decoration. */
export type DecorSpec = {
  token: string;
  /** How many of this decoration. Always at least 1. */
  count: number;
  /** 1-based tier, or 0 for "spread evenly across all the tiers". */
  tier: number;
};

/** The pattern the decorations follow on whichever tier they occupy. */
export type PlacementMode =
  | "top"
  | "crown"
  | "cascade"
  | "scattered"
  | "base"
  | "sides";

export type Density = "sparse" | "medium" | "rich";

/** Fallback count for a decoration the customer has not numbered explicitly. */
export const DENSITY_COUNT: Record<Density, number> = {
  sparse: 3,
  medium: 6,
  rich: 10,
};

export const PLACEMENT_MODES: PlacementMode[] = [
  "top",
  "crown",
  "cascade",
  "scattered",
  "base",
  "sides",
];

export function isPlacementMode(value: string): value is PlacementMode {
  return (PLACEMENT_MODES as string[]).includes(value);
}

export function isDensity(value: string): value is Density {
  return value === "sparse" || value === "medium" || value === "rich";
}

/**
 * Tokens that are not individual objects and therefore never get slots —
 * sprinkles are scattered dust and candles have their own upright treatment.
 */
export const NON_SLOT_TOKENS = new Set(["sprinkles", "candles"]);

/** How wide one decoration glyph is, in view units, before scaling. */
const GLYPH_WIDTH = 17;
/** Ceiling on the number of glyphs drawn, whatever the customer asks for. */
const MAX_SLOTS = 200;
/** Half-width of the fan used by the front-facing arrangement, in radians. */
const FRONT_SPAN = 1.15;

export function buildPlacement({
  specs,
  tiers,
  mode = "crown",
}: {
  specs: DecorSpec[];
  tiers: TierGeometry[];
  mode?: PlacementMode;
}): PlacementSlot[] {
  const usable = specs.filter(
    (spec) => !NON_SLOT_TOKENS.has(spec.token) && spec.count > 0,
  );
  if (usable.length === 0 || tiers.length === 0) return [];

  const tierCount = tiers.length;
  const slots: PlacementSlot[] = [];
  let order = 0;
  let budget = MAX_SLOTS;

  // How many decorations share each tier, so their phases can be staggered
  // without either of them losing its own symmetry.
  const occupancy = new Map<number, number>();
  for (const spec of usable) {
    for (const tier of tiersFor(spec, tierCount, mode)) {
      occupancy.set(tier, (occupancy.get(tier) ?? 0) + 1);
    }
  }
  const placedOnTier = new Map<number, number>();

  for (const spec of usable) {
    const assigned = tiersFor(spec, tierCount, mode);
    const shares = split(spec.count, assigned.length);

    assigned.forEach((tierIndex, i) => {
      const n = shares[i];
      if (n <= 0) return;

      const rank = placedOnTier.get(tierIndex) ?? 0;
      placedOnTier.set(tierIndex, rank + 1);
      const sharing = occupancy.get(tierIndex) ?? 1;

      const surface: Surface = mode === "sides" ? "side" : "top";
      const radius = radiusFor(mode);
      const scale = fitScale(tiers[tierIndex], radius, n, sharing);

      for (let j = 0; j < n; j += 1) {
        if (budget <= 0) return;
        budget -= 1;
        slots.push({
          id: `${spec.token}-${tierIndex}-${j}`,
          token: spec.token,
          tier: tierIndex,
          angle: angleFor(mode, j, n, rank, sharing, tierIndex),
          radius,
          surface,
          scale,
          order: order++,
        });
      }
    });
  }

  // Nearer items last, so the painter's algorithm in the side view is simply
  // "draw in array order".
  return slots.sort((a, b) => Math.cos(b.angle) - Math.cos(a.angle));
}

/* ------------------------------------------------------------------ *
 * Symmetry
 * ------------------------------------------------------------------ */

/**
 * Splits a count across tiers as evenly as possible, giving any remainder to
 * the upper tiers — where an extra piece reads as deliberate rather than as a
 * mistake.
 */
function split(count: number, buckets: number): number[] {
  if (buckets <= 1) return [count];

  const base = Math.floor(count / buckets);
  const remainder = count % buckets;

  return Array.from({ length: buckets }, (_, i) =>
    buckets - i <= remainder ? base + 1 : base,
  );
}

/**
 * Which tiers a decoration occupies.
 *
 * The per-decoration tier is authoritative: the card says "Всички етажи" or
 * "2", and that is what has to happen. The arrangement mode decides the
 * *pattern* on whichever tiers these are — a ring, a front-facing arc, the
 * walls — and never quietly moves the decoration somewhere else. The single
 * exception is `base`, which is defined as "around the foot" and so is a
 * statement about the tier rather than about the pattern.
 */
function tiersFor(
  spec: DecorSpec,
  tierCount: number,
  mode: PlacementMode,
): number[] {
  if (mode === "base") return [0];

  if (spec.tier >= 1 && spec.tier <= tierCount) {
    // The customer counts tiers from the bottom, like everyone else.
    return [spec.tier - 1];
  }

  return Array.from({ length: tierCount }, (_, i) => i);
}

/**
 * The angle of item `j` of `n`.
 *
 * Both arrangements are mirror-symmetric about the axis facing the viewer, so
 * the cake reads as balanced from the front as well as from above.
 */
function angleFor(
  mode: PlacementMode,
  j: number,
  n: number,
  rank: number,
  sharing: number,
  tierIndex: number,
): number {
  if (mode === "top") {
    // A symmetric fan across the front. A lone item sits dead centre.
    if (n === 1) return 0;
    const step = (FRONT_SPAN * 2) / (n - 1);
    return -FRONT_SPAN + j * step;
  }

  // Everything else is a full ring at exactly 360°/n.
  const step = (Math.PI * 2) / n;

  // Decorations sharing a tier are offset by a fraction of one step so they
  // interleave instead of colliding, while each keeps its own symmetry.
  let phase = sharing > 1 ? (rank / sharing) * step : 0;

  // A cascade rotates each tier's ring half a step against the one below, so
  // the stack reads as a spiral without any item leaving its even spacing.
  if (mode === "cascade") phase += (tierIndex % 2) * (step / 2);

  return j * step + phase;
}

/**
 * How far out the ring sits, as a fraction of the tier's half-width.
 *
 * This is the other half of what makes the arrangements distinct: they are all
 * symmetric rings, and what separates them is where the ring sits and how the
 * tiers relate to each other.
 */
function radiusFor(mode: PlacementMode): number {
  switch (mode) {
    case "top":
      return 0.6;
    case "scattered":
      // Drawn in from the edge, sitting on the surface rather than the rim.
      return 0.55;
    case "base":
      return 0.99;
    case "sides":
      return 1;
    default:
      return 0.84;
  }
}

/**
 * Shrinks the glyphs when a ring gets crowded.
 *
 * Seventeen raspberries on a small top tier would otherwise overlap into a
 * solid band. The arc available per item is what decides the size, so the
 * spacing stays visually even whatever number the customer types.
 */
function fitScale(
  tier: TierGeometry,
  radius: number,
  n: number,
  sharing: number,
): number {
  const circumference = Math.PI * tier.width * radius;
  const perItem = circumference / Math.max(1, n * sharing);
  return Math.max(0.4, Math.min(1.15, perItem / GLYPH_WIDTH));
}

/* ------------------------------------------------------------------ *
 * Projections
 * ------------------------------------------------------------------ */

export type Projected = {
  x: number;
  y: number;
  scale: number;
  /** −1 (far side) … 1 (nearest the viewer). */
  depth: number;
};

/**
 * Keeps an item off the part of a tier that the tier above is standing on.
 *
 * The middle of a lower tier's top surface is not a surface at all — it is
 * underneath the next tier. Decorations aimed there vanish in the elevation
 * and read as floating inside the cake from above, so anything below the top
 * tier is pushed out onto the visible ledge.
 */
function ledgeRadius(slot: PlacementSlot, tiers: TierGeometry[]): number {
  if (slot.surface === "side") return slot.radius;

  const tier = tiers[Math.min(slot.tier, tiers.length - 1)];
  const above = tiers[slot.tier + 1];
  if (!above) return slot.radius;

  const covered = above.width / tier.width;
  const minimum = Math.min(0.94, covered + 0.14);
  return Math.max(slot.radius, minimum);
}

/**
 * Side elevation.
 *
 * The top surface of a tier reads as an ellipse, so an item's vertical offset
 * is the cosine of its angle scaled by the cap's minor radius — the same
 * relationship that makes the cap look like a circle in perspective.
 */
export function projectSide(
  slot: PlacementSlot,
  tiers: TierGeometry[],
  shape: CakeShape = "round",
): Projected {
  const tier = tiers[Math.min(slot.tier, tiers.length - 1)];
  const depth = Math.cos(slot.angle);
  const radius = ledgeRadius(slot, tiers);
  const offset = outlineOffset(shape, slot.angle);
  const x = tier.cx + offset.x * tier.width * radius;

  // The cap's depth is measured against the shape's own plan, so a shape that
  // is not as deep as it is wide still lands its ring on its own rim.
  const reach = (2 * tier.capRy) / planAspect(shape);

  const y =
    slot.surface === "side"
      ? // Clinging to the wall: the same distance below the rim all the way
        // round, which means following the rim rather than a flat line — on a
        // heart the rim swings by half the height of the tier.
        tier.top + offset.y * reach + (tier.height - tier.capRy) * 0.45
      : tier.top + offset.y * reach * radius;

  return {
    x: snap(x),
    y: snap(y),
    // Items at the front are nearer the viewer, so slightly larger.
    scale: snap(slot.scale * (0.88 + ((depth + 1) / 2) * 0.24)),
    depth,
  };
}

/**
 * Items on the far side of the cake are behind the body and cannot be seen in
 * elevation. Hiding them is what makes the second viewpoint worth having.
 */
export function isVisibleFromSide(slot: PlacementSlot): boolean {
  return Math.cos(slot.angle) > (slot.surface === "side" ? 0.12 : -0.42);
}

/**
 * Plan view. Tiers are concentric, so the radius in the picture combines the
 * tier's own half-width with the item's distance from the axis.
 */
export function projectTop(
  slot: PlacementSlot,
  tiers: TierGeometry[],
  centre: { cx: number; cy: number },
  /** Picture radius of the widest tier. */
  outerRadius: number,
  shape: CakeShape = "round",
): Projected {
  const tier = tiers[Math.min(slot.tier, tiers.length - 1)];
  const widest = Math.max(...tiers.map((t) => t.width));
  const tierRadius = outerRadius * (tier.width / widest);

  // Wall-mounted items sit exactly on their tier's outline from above.
  const r = slot.surface === "side" ? 1 : ledgeRadius(slot, tiers);
  const offset = outlineOffset(shape, slot.angle);

  return {
    x: snap(centre.cx + offset.x * 2 * tierRadius * r),
    // The plan is drawn with the viewer at the bottom of the picture, which
    // is where the elevation looks at the cake from — so the slot facing the
    // viewer is the one nearest the "Отпред" marker, not the one opposite it.
    y: snap(centre.cy + offset.y * 2 * tierRadius * r),
    scale: snap(slot.scale),
    depth: Math.cos(slot.angle),
  };
}

/* ------------------------------------------------------------------ *
 * Reading the configuration
 * ------------------------------------------------------------------ */

/**
 * Turns the chosen decorations and their per-option settings into specs.
 *
 * Kept here rather than in the renderers so the elevation and the plan view
 * can never disagree about what the customer asked for.
 */
export function specsFrom({
  tokens,
  details,
  density,
}: {
  tokens: string[];
  details: Record<string, { tier?: number; count?: number }>;
  density: Density;
}): DecorSpec[] {
  return tokens
    .filter((token) => !NON_SLOT_TOKENS.has(token))
    .map((token) => {
      const detail = details[token] ?? {};
      return {
        token,
        count: detail.count ?? DENSITY_COUNT[density],
        tier: detail.tier ?? 0,
      };
    });
}
