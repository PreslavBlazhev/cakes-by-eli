import { describe, expect, it } from "vitest";

import { buildTiers } from "@/features/configurator/preview/geometry";
import {
  buildPlacement,
  DENSITY_COUNT,
  isDensity,
  isPlacementMode,
  isVisibleFromSide,
  projectSide,
  projectTop,
  specsFrom,
} from "@/features/configurator/preview/placement";
import type { DecorSpec } from "@/features/configurator/preview/placement";

const CENTRE = { cx: 200, cy: 200 };
const OUTER = 138;

const TIERS_3 = buildTiers(3, "round");
const TIERS_1 = buildTiers(1, "round");

const spec = (token: string, count: number, tier = 0): DecorSpec => ({
  token,
  count,
  tier,
});

/** Angles of one decoration, sorted, normalised into [0, 2π). */
function anglesOf(slots: { token: string; angle: number }[], token: string) {
  return slots
    .filter((s) => s.token === token)
    .map((s) => ((s.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    .sort((a, b) => a - b);
}

describe("counts", () => {
  it("draws exactly the number the customer asked for", () => {
    for (const n of [1, 2, 5, 12, 17, 40]) {
      const slots = buildPlacement({
        specs: [spec("raspberries", n)],
        tiers: TIERS_1,
      });
      expect(slots).toHaveLength(n);
    }
  });

  it("splits an explicit count across the tiers when none is chosen", () => {
    const slots = buildPlacement({ specs: [spec("raspberries", 17)], tiers: TIERS_3 });
    expect(slots).toHaveLength(17);
    const perTier = [0, 1, 2].map(
      (t) => slots.filter((s) => s.tier === t).length,
    );
    expect(perTier.reduce((a, b) => a + b, 0)).toBe(17);
    // 17 over three tiers can only be 5/6/6 — never lopsided.
    expect(Math.max(...perTier) - Math.min(...perTier)).toBeLessThanOrEqual(1);
  });

  it("honours an explicit tier and puts everything there", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 9, 2)],
      tiers: TIERS_3,
    });
    expect(slots).toHaveLength(9);
    expect(slots.every((s) => s.tier === 1)).toBe(true);
  });

  it("keeps different decorations on the tiers they were each given", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 6, 3), spec("blueberries", 6, 1)],
      tiers: TIERS_3,
    });
    expect(
      slots.filter((s) => s.token === "raspberries").every((s) => s.tier === 2),
    ).toBe(true);
    expect(
      slots.filter((s) => s.token === "blueberries").every((s) => s.tier === 0),
    ).toBe(true);
  });

  it("ignores decorations that are not individual objects", () => {
    const slots = buildPlacement({
      specs: [spec("sprinkles", 10), spec("candles", 3), spec("cherries", 4)],
      tiers: TIERS_1,
    });
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.token === "cherries")).toBe(true);
  });

  it("gives every slot a unique key", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 17), spec("blueberries", 11)],
      tiers: TIERS_3,
    });
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
  });

  it("caps the drawing rather than melting on an absurd request", () => {
    const slots = buildPlacement({
      specs: [spec("a", 40), spec("b", 40), spec("c", 40), spec("d", 40), spec("e", 40)],
      tiers: TIERS_3,
    });
    expect(slots.length).toBeLessThanOrEqual(200);
  });
});

describe("symmetry — the whole point", () => {
  it("spaces a ring at exactly 360°/n, for every n", () => {
    for (const n of [3, 5, 8, 17, 23]) {
      const slots = buildPlacement({
        specs: [spec("raspberries", n)],
        tiers: TIERS_1,
        mode: "crown",
      });
      const angles = anglesOf(slots, "raspberries");
      const gaps = angles.map((a, i) =>
        i === 0
          ? angles[0] + Math.PI * 2 - angles[angles.length - 1]
          : a - angles[i - 1],
      );
      const expected = (Math.PI * 2) / n;
      for (const gap of gaps) expect(gap).toBeCloseTo(expected, 6);
    }
  });

  it("keeps each decoration symmetric even when several share a tier", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 7, 1), spec("blueberries", 5, 1)],
      tiers: TIERS_1,
      mode: "crown",
    });
    for (const [token, n] of [
      ["raspberries", 7],
      ["blueberries", 5],
    ] as const) {
      const angles = anglesOf(slots, token);
      expect(angles).toHaveLength(n);
      const gaps = angles.map((a, i) =>
        i === 0
          ? angles[0] + Math.PI * 2 - angles[angles.length - 1]
          : a - angles[i - 1],
      );
      for (const gap of gaps) expect(gap).toBeCloseTo((Math.PI * 2) / n, 6);
    }
  });

  it("mirrors the front arrangement about the axis facing the viewer", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 6)],
      tiers: TIERS_1,
      mode: "top",
    });
    const angles = slots.map((s) => s.angle).sort((a, b) => a - b);
    for (let i = 0; i < angles.length / 2; i += 1) {
      expect(angles[i]).toBeCloseTo(-angles[angles.length - 1 - i], 6);
    }
  });

  it("centres a single front item instead of offsetting it", () => {
    const [only] = buildPlacement({
      specs: [spec("raspberries", 1)],
      tiers: TIERS_1,
      mode: "top",
    });
    expect(only.angle).toBe(0);
  });

  it("is deterministic, so server and client render identical SVG", () => {
    const build = () =>
      buildPlacement({
        specs: [spec("raspberries", 17), spec("mint", 6)],
        tiers: TIERS_3,
        mode: "crown",
      });
    expect(build()).toEqual(build());
  });

  it("shrinks the glyphs as a ring gets crowded, so they never overlap", () => {
    const few = buildPlacement({ specs: [spec("raspberries", 4)], tiers: TIERS_1 });
    const many = buildPlacement({ specs: [spec("raspberries", 34)], tiers: TIERS_1 });
    expect(many[0].scale).toBeLessThan(few[0].scale);
    expect(many[0].scale).toBeGreaterThan(0);
  });

  it("gives every item of one decoration the same size", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 17, 2)],
      tiers: TIERS_3,
    });
    expect(new Set(slots.map((s) => s.scale)).size).toBe(1);
  });
});

describe("specsFrom", () => {
  it("falls back to the group density when no count was typed", () => {
    const specs = specsFrom({
      tokens: ["raspberries"],
      details: {},
      density: "rich",
    });
    expect(specs[0].count).toBe(DENSITY_COUNT.rich);
    expect(specs[0].tier).toBe(0);
  });

  it("prefers the customer's own count and tier", () => {
    const specs = specsFrom({
      tokens: ["raspberries"],
      details: { raspberries: { count: 17, tier: 2 } },
      density: "sparse",
    });
    expect(specs[0]).toEqual({ token: "raspberries", count: 17, tier: 2 });
  });

  it("drops the decorations that have no individual slots", () => {
    const specs = specsFrom({
      tokens: ["sprinkles", "raspberries"],
      details: {},
      density: "medium",
    });
    expect(specs.map((s) => s.token)).toEqual(["raspberries"]);
  });
});

describe("projections", () => {
  it("hides the far side from the elevation but never from the plan", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 12)],
      tiers: TIERS_3,
      mode: "crown",
    });
    const visible = slots.filter(isVisibleFromSide);

    expect(visible.length).toBeLessThan(slots.length);
    expect(visible.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const point = projectTop(slot, TIERS_3, CENTRE, OUTER);
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it("keeps lower-tier items off the area the tier above stands on", () => {
    const covered = TIERS_3[1].width / TIERS_3[0].width;
    const slots = buildPlacement({
      specs: [spec("raspberries", 12, 1)],
      tiers: TIERS_3,
      mode: "crown",
    });

    expect(slots.length).toBe(12);
    for (const slot of slots) {
      const point = projectTop(slot, TIERS_3, CENTRE, OUTER);
      const distance = Math.hypot(point.x - CENTRE.cx, point.y - CENTRE.cy);
      expect(distance).toBeGreaterThanOrEqual(OUTER * covered * 0.99);
    }
  });

  it("draws front items larger than the ones at the back", () => {
    const [front] = buildPlacement({
      specs: [spec("strawberries", 1)],
      tiers: TIERS_1,
      mode: "top",
    });
    const back = { ...front, angle: Math.PI };
    expect(projectSide(front, TIERS_1).scale).toBeGreaterThan(
      projectSide(back, TIERS_1).scale,
    );
  });

  it("places the same slot on the same side in both views", () => {
    const slots = buildPlacement({
      specs: [spec("raspberries", 9)],
      tiers: TIERS_1,
      mode: "crown",
    });

    for (const slot of slots) {
      const side = projectSide(slot, TIERS_1);
      const top = projectTop(slot, TIERS_1, CENTRE, OUTER);
      expect(Math.sign(Math.round((side.x - TIERS_1[0].cx) * 1000))).toBe(
        Math.sign(Math.round((top.x - CENTRE.cx) * 1000)),
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
