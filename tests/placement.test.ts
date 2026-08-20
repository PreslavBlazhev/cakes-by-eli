import { describe, expect, it } from "vitest";

import { buildTiers } from "@/features/configurator/preview/geometry";
import {
  buildPlacement,
  isDensity,
  isPlacementMode,
  isVisibleFromSide,
  projectSide,
  projectTop,
} from "@/features/configurator/preview/placement";

const CENTRE = { cx: 200, cy: 200 };
const OUTER = 138;

const FRUIT = ["strawberries", "blueberries", "pearls"];

describe("buildPlacement — how many", () => {
  it("gives every token the number of items the density asks for", () => {
    expect(
      buildPlacement({ tokens: FRUIT, tierCount: 3, density: "sparse" }),
    ).toHaveLength(3 * 2);
    expect(
      buildPlacement({ tokens: FRUIT, tierCount: 3, density: "medium" }),
    ).toHaveLength(3 * 3);
    expect(
      buildPlacement({ tokens: FRUIT, tierCount: 3, density: "rich" }),
    ).toHaveLength(3 * 5);
  });

  it("ignores decorations that are not individual objects", () => {
    const slots = buildPlacement({
      tokens: ["sprinkles", "candles", "strawberries"],
      tierCount: 1,
      density: "sparse",
    });
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.token === "strawberries")).toBe(true);
  });

  it("returns nothing when only non-placeable tokens are chosen", () => {
    expect(
      buildPlacement({ tokens: ["sprinkles", "candles"], tierCount: 3 }),
    ).toEqual([]);
  });

  it("caps the arrangement at five kinds", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"];
    const slots = buildPlacement({
      tokens: many,
      tierCount: 1,
      density: "sparse",
    });
    expect(new Set(slots.map((s) => s.token)).size).toBe(5);
  });

  it("gives every slot a unique key", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "scattered",
      density: "rich",
    });
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
  });
});

describe("buildPlacement — where", () => {
  it("keeps `top` on the top tier only", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "top",
      density: "rich",
    });
    expect(slots.every((s) => s.tier === 2)).toBe(true);
  });

  it("spreads `cascade` across every tier — the point of the feature", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "cascade",
      density: "rich",
    });
    expect(new Set(slots.map((s) => s.tier))).toEqual(new Set([0, 1, 2]));
  });

  it("uses lower tiers for `scattered` and `sides` too", () => {
    for (const mode of ["scattered", "sides"] as const) {
      const slots = buildPlacement({
        tokens: FRUIT,
        tierCount: 3,
        mode,
        density: "rich",
      });
      expect(new Set(slots.map((s) => s.tier)).size).toBeGreaterThan(1);
    }
  });

  it("gathers `base` on the bottom tier", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "base",
      density: "medium",
    });
    expect(slots.every((s) => s.tier === 0)).toBe(true);
  });

  it("attaches `sides` to the walls rather than the surfaces", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "sides",
      density: "medium",
    });
    expect(slots.every((s) => s.surface === "side")).toBe(true);
  });

  it("spreads a crown right around the cake, not just the front", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 1,
      mode: "crown",
      density: "rich",
    });
    const behind = slots.filter((s) => Math.cos(s.angle) < 0);
    expect(behind.length).toBeGreaterThan(0);
  });

  it("degrades a cascade to a crown when there is only one tier", () => {
    const single = buildPlacement({
      tokens: FRUIT,
      tierCount: 1,
      mode: "cascade",
      density: "medium",
    });
    const crown = buildPlacement({
      tokens: FRUIT,
      tierCount: 1,
      mode: "crown",
      density: "medium",
    });
    expect(single.map((s) => s.angle)).toEqual(crown.map((s) => s.angle));
  });

  it("interleaves the kinds so one fruit never clumps in a single arc", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 1,
      mode: "crown",
      density: "medium",
    });
    // Neighbours around the ring should differ in kind.
    const byAngle = [...slots].sort((a, b) => a.angle - b.angle);
    const adjacentSame = byAngle.filter(
      (slot, i) => i > 0 && byAngle[i - 1].token === slot.token,
    );
    expect(adjacentSame).toHaveLength(0);
  });

  it("is deterministic, so server and client render identical SVG", () => {
    const once = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "scattered",
      density: "rich",
    });
    const twice = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "scattered",
      density: "rich",
    });
    expect(once).toEqual(twice);
  });
});

describe("projections", () => {
  const tiers = buildTiers(3, "round");

  it("hides the far side from the elevation but never from the plan", () => {
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "crown",
      density: "rich",
    });
    const visible = slots.filter(isVisibleFromSide);

    expect(visible.length).toBeLessThan(slots.length);
    expect(visible.length).toBeGreaterThan(0);
    // The plan view is the whole reason the second block exists.
    for (const slot of slots) {
      const point = projectTop(slot, tiers, CENTRE, OUTER);
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it("keeps lower-tier items off the area the tier above stands on", () => {
    const tier0 = tiers[0];
    const tier1 = tiers[1];
    const covered = tier1.width / tier0.width;

    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 3,
      mode: "scattered",
      density: "rich",
    }).filter((s) => s.tier === 0);

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const point = projectTop(slot, tiers, CENTRE, OUTER);
      const distance = Math.hypot(point.x - CENTRE.cx, point.y - CENTRE.cy);
      const outerRadius = OUTER * (tier0.width / tier0.width);
      expect(distance).toBeGreaterThanOrEqual(outerRadius * covered * 0.99);
    }
  });

  it("draws front items larger than the ones at the back", () => {
    const tiers1 = buildTiers(1, "round");
    const [front] = buildPlacement({
      tokens: ["strawberries"],
      tierCount: 1,
      mode: "top",
      density: "sparse",
    });
    const back = { ...front, angle: Math.PI };
    expect(projectSide(front, tiers1).scale).toBeGreaterThan(
      projectSide(back, tiers1).scale,
    );
  });

  it("places the same slot at the same angle in both views", () => {
    const tiers1 = buildTiers(1, "round");
    const slots = buildPlacement({
      tokens: FRUIT,
      tierCount: 1,
      mode: "crown",
      density: "medium",
    });

    for (const slot of slots) {
      const side = projectSide(slot, tiers1);
      const top = projectTop(slot, tiers1, CENTRE, OUTER);
      // Both views put an item left of centre iff its angle is negative.
      expect(Math.sign(side.x - tiers1[0].cx)).toBe(
        Math.sign(top.x - CENTRE.cx),
      );
    }
  });
});

describe("channel guards", () => {
  it("accepts only the arrangements the renderers implement", () => {
    expect(isPlacementMode("cascade")).toBe(true);
    expect(isPlacementMode("nonsense")).toBe(false);
    expect(isDensity("rich")).toBe(true);
    expect(isDensity("enormous")).toBe(false);
  });
});
