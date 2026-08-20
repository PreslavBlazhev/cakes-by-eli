import { seeded } from "./geometry";
import type { TierGeometry } from "./geometry";

/**
 * Where every decoration sits — resolved once, drawn from two viewpoints.
 *
 * The customer picks *how* the decorations are arranged, not just which ones
 * they want, so the arrangement has to be a first-class piece of data rather
 * than something each renderer improvises. A slot is described in the cake's
 * own cylindrical coordinates — which tier, which way round, how far from the
 * axis — and each view projects that description in its own way. Because both
 * views read the same slots, the blueberry the customer sees at the back in
 * the top view is the same blueberry hidden behind the cake in the side view.
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
  /** Size multiplier before any view-specific perspective is applied. */
  scale: number;
  /** Draw order seed — later items sit in front. */
  order: number;
};

/** How the customer chose to arrange the decorations. */
export type PlacementMode =
  | "top"
  | "crown"
  | "cascade"
  | "scattered"
  | "base"
  | "sides";

export type Density = "sparse" | "medium" | "rich";

const PER_TOKEN: Record<Density, number> = {
  sparse: 2,
  medium: 3,
  rich: 5,
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

export function buildPlacement({
  tokens,
  tierCount,
  mode = "top",
  density = "medium",
}: {
  tokens: string[];
  tierCount: number;
  mode?: PlacementMode;
  density?: Density;
}): PlacementSlot[] {
  const items = tokens.filter((t) => !NON_SLOT_TOKENS.has(t)).slice(0, 5);
  if (items.length === 0) return [];

  const tiers = Math.max(1, Math.min(3, tierCount));
  const perToken = PER_TOKEN[density];
  const slots: PlacementSlot[] = [];

  // `cascade` and `sides` need more than one tier to mean anything; with a
  // single tier they degrade to the arrangements that read closest to them.
  const effective: PlacementMode =
    tiers === 1 && mode === "cascade" ? "crown" : mode;

  items.forEach((token, tokenIndex) => {
    for (let i = 0; i < perToken; i += 1) {
      const seed = tokenIndex * 17 + i * 5 + 3;
      slots.push({
        ...position(effective, {
          tokenIndex,
          itemIndex: i,
          perToken,
          tokenCount: items.length,
          tiers,
          seed,
        }),
        id: `${token}-${i}`,
        token,
        order: tokenIndex * perToken + i,
      });
    }
  });

  // Nearer items last, so the painter's algorithm in the side view is simply
  // "draw in array order".
  return slots.sort((a, b) => Math.cos(b.angle) - Math.cos(a.angle));
}

type Ctx = {
  tokenIndex: number;
  itemIndex: number;
  perToken: number;
  tokenCount: number;
  tiers: number;
  seed: number;
};

function position(
  mode: PlacementMode,
  ctx: Ctx,
): Omit<PlacementSlot, "id" | "token" | "order"> {
  const { tokenIndex, itemIndex, perToken, tokenCount, tiers, seed } = ctx;

  const total = tokenCount * perToken;
  /** Interleaved rank of this item across all tokens. */
  const rank = itemIndex * tokenCount + tokenIndex;
  /** Position of this item within the whole arrangement, 0…1. */
  const global = rank / Math.max(1, total - 1);
  /** Spread within this token's own cluster, -1…1. */
  const local = perToken === 1 ? 0 : (itemIndex / (perToken - 1)) * 2 - 1;

  switch (mode) {
    /* Everything gathered on the top tier, facing the viewer. */
    case "top": {
      const fan = ((tokenIndex - (tokenCount - 1) / 2) / Math.max(1, tokenCount)) * 0.9;
      return {
        tier: tiers - 1,
        angle: local * 1.15 + fan,
        radius: 0.42 + Math.abs(local) * 0.24,
        surface: "top",
        scale: 0.92 + (1 - Math.abs(local)) * 0.14,
      };
    }

    /* An even ring around the rim of the top tier. */
    case "crown": {
      return {
        tier: tiers - 1,
        angle: (rank / total) * Math.PI * 2,
        radius: 0.84,
        surface: "top",
        scale: 0.9,
      };
    }

    /*
     * The classic cascade: a diagonal spill that starts at the back of the
     * top tier and runs forward and down across the tiers below.
     */
    case "cascade": {
      const t = global;
      const tier = Math.min(tiers - 1, Math.floor((1 - t) * tiers));
      return {
        tier,
        // Spirals from the back of the top tier round to the front as it
        // descends, alternating sides so the spill straddles the cake.
        angle: Math.PI * (1 - t * 1.35) * (rank % 2 === 0 ? 1 : -1),
        radius: 0.66 + (seeded(seed) - 0.5) * 0.26,
        surface: "top",
        scale: 0.88 + t * 0.2,
      };
    }

    /* Spread over every tier, deliberately irregular but reproducible. */
    case "scattered": {
      const tier = (tokenIndex + itemIndex) % tiers;
      return {
        tier,
        angle: seeded(seed) * Math.PI * 2,
        radius: 0.3 + seeded(seed + 91) * 0.55,
        surface: "top",
        scale: 0.84 + seeded(seed + 7) * 0.26,
      };
    }

    /* Gathered around the foot of the cake. */
    case "base": {
      return {
        tier: 0,
        angle: (rank / total) * Math.PI * 2 + 0.2,
        radius: 0.95,
        surface: "top",
        scale: 0.95,
      };
    }

    /* Applied to the walls rather than the surfaces. */
    case "sides": {
      const tier = rank % tiers;
      return {
        tier,
        angle: ((rank / total) * Math.PI * 2 + tier * 0.7) % (Math.PI * 2),
        radius: 1,
        surface: "side",
        scale: 0.78,
      };
    }
  }
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
): Projected {
  const tier = tiers[Math.min(slot.tier, tiers.length - 1)];
  const depth = Math.cos(slot.angle);
  const radius = ledgeRadius(slot, tiers);
  const halfWidth = (tier.width / 2) * radius;
  const x = tier.cx + Math.sin(slot.angle) * halfWidth;

  const y =
    slot.surface === "side"
      ? // Clinging to the wall: sit at a stable height on the tier face.
        tier.top + tier.capRy + (tier.height - tier.capRy) * 0.45
      : tier.top + depth * tier.capRy * radius;

  return {
    x,
    y,
    // Items at the front are nearer the viewer, so slightly larger.
    scale: slot.scale * (0.88 + ((depth + 1) / 2) * 0.24),
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
): Projected {
  const tier = tiers[Math.min(slot.tier, tiers.length - 1)];
  const widest = Math.max(...tiers.map((t) => t.width));
  const tierRadius = outerRadius * (tier.width / widest);

  // Wall-mounted items sit exactly on their tier's outline from above.
  const r =
    slot.surface === "side"
      ? tierRadius
      : tierRadius * ledgeRadius(slot, tiers);

  return {
    x: centre.cx + Math.sin(slot.angle) * r,
    y: centre.cy - Math.cos(slot.angle) * r,
    scale: slot.scale,
    depth: Math.cos(slot.angle),
  };
}
