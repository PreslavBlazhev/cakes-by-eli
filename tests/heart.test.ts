import { describe, expect, it } from "vitest";

import {
  BASELINE,
  buildTiers,
  dripPath,
  heartCapPath,
  HEART_ASPECT,
  heartFootPoints,
  heartPath,
  outlineOffset,
  snap,
  tierBodyPath,
} from "@/features/configurator/preview/geometry";
import type { CakeShape } from "@/features/configurator/preview/geometry";
import {
  buildPlacement,
  projectSide,
  projectTop,
} from "@/features/configurator/preview/placement";

/**
 * The heart used to be five hand-tuned Bézier curves that did not look like a
 * heart, and it was the one shape the configurator refused to stack. What is
 * pinned here is the shape itself — its symmetry, its proportions, the fact
 * that it has a notch and a point — rather than any particular path string,
 * so the drawing can be restyled without the tests having to be rewritten.
 */

const CENTRE = { cx: 200, cy: 200 };
const OUTER = 138;

/** The outline sampled at `count` even steps round its edge. */
function ring(shape: CakeShape, count: number) {
  return Array.from({ length: count }, (_, i) =>
    outlineOffset(shape, (i / count) * Math.PI * 2),
  );
}

function gap(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * The length of edge between two bearings, walked rather than measured
 * straight across — the shortcut across the point of a heart or the corner of
 * a square is much shorter than the edge itself.
 */
function edgeBetween(shape: CakeShape, from: number, to: number) {
  const steps = 200;
  let total = 0;
  let previous = outlineOffset(shape, from);

  for (let i = 1; i <= steps; i += 1) {
    const point = outlineOffset(shape, from + ((to - from) * i) / steps);
    total += gap(previous, point);
    previous = point;
  }

  return total;
}

describe("the heart is a heart", () => {
  it("is exactly symmetric about its own axis", () => {
    for (let i = 1; i < 180; i += 1) {
      const angle = (i / 180) * Math.PI;
      const right = outlineOffset("heart", angle);
      const left = outlineOffset("heart", -angle);

      // Mirrored, not merely similar: the left half is computed from the right.
      expect(left.x).toBeCloseTo(-right.x, 12);
      expect(left.y).toBeCloseTo(right.y, 12);
    }
  });

  it("is a shade wider than it is tall, like every heart anyone draws", () => {
    expect(HEART_ASPECT).toBeGreaterThan(0.85);
    expect(HEART_ASPECT).toBeLessThan(0.95);
  });

  it("comes to a single point at the front", () => {
    const tip = outlineOffset("heart", 0);
    expect(tip.x).toBeCloseTo(0, 10);

    // Nothing on the outline reaches further towards the viewer.
    for (const point of ring("heart", 720)) {
      expect(point.y).toBeLessThanOrEqual(tip.y + 1e-9);
    }
  });

  it("dips into a notch between two lobes at the back", () => {
    const notch = outlineOffset("heart", Math.PI);
    expect(notch.x).toBeCloseTo(0, 10);

    // The lobes rise above the notch — that dip is what makes it a heart and
    // not an egg. Half the width away from the axis is comfortably on a lobe.
    const lobe = ring("heart", 720).filter((p) => p.x > 0.18 && p.x < 0.34);
    expect(lobe.length).toBeGreaterThan(0);
    expect(Math.min(...lobe.map((p) => p.y))).toBeLessThan(notch.y - 0.05);
  });
});

describe("decorations are spaced evenly round the edge, whatever the edge is", () => {
  // The promise the placement model makes is even spacing. Casting rays from
  // the centre keeps the angles even but not the distances, and on a heart
  // that bunches the fruit either side of the notch.
  for (const shape of ["round", "square", "rect", "heart"] as CakeShape[]) {
    it(shape, () => {
      for (const count of [5, 8, 12, 17]) {
        const step = (Math.PI * 2) / count;
        const gaps = Array.from({ length: count }, (_, i) =>
          edgeBetween(shape, i * step, (i + 1) * step),
        );
        const spread = Math.max(...gaps) / Math.min(...gaps);
        expect(spread).toBeLessThan(1.02);
      }
    });
  }

  it("puts a lone item at the front and its neighbours symmetrically", () => {
    const points = ring("heart", 4);
    expect(points[0].x).toBeCloseTo(0, 10);
    expect(points[1].x).toBeCloseTo(-points[3].x, 10);
    expect(points[1].y).toBeCloseTo(points[3].y, 10);
  });
});

describe("a heart cake is a cake", () => {
  it("stacks like every other shape", () => {
    const tiers = buildTiers(3, "heart");
    expect(tiers).toHaveLength(3);

    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i].width).toBeLessThan(tiers[i - 1].width);
      expect(tiers[i].top).toBeLessThan(tiers[i - 1].top);
      // Resting on the tier below, not hovering over it.
      expect(tiers[i].bottom).toBeGreaterThan(tiers[i - 1].top);
    }
  });

  it("rests its point on the stand rather than through it", () => {
    for (const count of [1, 2, 3]) {
      const [foot] = buildTiers(count, "heart");
      // The point is the nearest part of the foot and so the lowest drawn.
      expect(foot.bottom + foot.capRy).toBeCloseTo(BASELINE, 6);
    }
  });

  it("is drawn from high enough up for the shape to read", () => {
    const [round] = buildTiers(1, "round");
    const [heart] = buildTiers(1, "heart");
    expect(heart.capRy).toBeGreaterThan(round.capRy * 3);
  });

  it("draws a wall, a top and a drip without a single NaN", () => {
    const tiers = buildTiers(2, "heart");
    for (const tier of tiers) {
      for (const path of [
        heartCapPath(tier),
        tierBodyPath(tier, "heart"),
        dripPath(tier, "heart"),
        heartPath(tier.cx, tier.top, tier.width),
      ]) {
        expect(path).not.toMatch(/NaN|Infinity|undefined/);
        expect(path.startsWith("M")).toBe(true);
      }
    }
  });

  it("runs the piping round the foot instead of straight across it", () => {
    const [tier] = buildTiers(1, "heart");
    const points = heartFootPoints(tier, 12, 4);

    expect(points).toHaveLength(12);
    // A curve, not a line: the middle of the foot hangs below its ends.
    const middle = points[Math.floor(points.length / 2)];
    expect(middle.y).toBeGreaterThan(points[0].y + 10);
    expect(points[0].y).toBeCloseTo(points[points.length - 1].y, 6);
  });
});

describe("the two views agree", () => {
  const tiers = buildTiers(2, "heart");
  const slots = buildPlacement({
    specs: [{ token: "raspberries", count: 12, tier: 0 }],
    tiers,
    mode: "crown",
  });

  it("puts every decoration on the same side and the same way round", () => {
    expect(slots.length).toBe(12);

    for (const slot of slots) {
      const side = projectSide(slot, tiers, "heart");
      const top = projectTop(slot, tiers, CENTRE, OUTER, "heart");

      expect(Math.sign(Math.round((side.x - tiers[slot.tier].cx) * 1000))).toBe(
        Math.sign(Math.round((top.x - CENTRE.cx) * 1000)),
      );
      // Both views put the front of the cake towards the bottom of the frame.
      expect(Math.sign(Math.round((side.y - tiers[slot.tier].top) * 1000))).toBe(
        Math.sign(Math.round((top.y - CENTRE.cy) * 1000)),
      );
    }
  });
});

describe("server and client draw the same picture", () => {
  it("snaps every coordinate to a precision both engines can agree on", () => {
    const tiers = buildTiers(3, "heart");
    const slots = buildPlacement({
      specs: [{ token: "raspberries", count: 17, tier: 0 }],
      tiers,
      mode: "crown",
    });

    for (const slot of slots) {
      // `depth` never reaches an attribute — it only decides what is hidden.
      const side = projectSide(slot, tiers, "heart");
      const top = projectTop(slot, tiers, CENTRE, OUTER, "heart");

      for (const point of [side, top]) {
        expect(snap(point.x)).toBe(point.x);
        expect(snap(point.y)).toBe(point.y);
        expect(snap(point.scale)).toBe(point.scale);
      }
    }
  });

  it("draws the same paths every time, cache or no cache", () => {
    const [tier] = buildTiers(1, "heart");
    expect(tierBodyPath(tier, "heart")).toBe(tierBodyPath(tier, "heart"));
    expect(outlineOffset("heart", 1.234)).toEqual(outlineOffset("heart", 1.234));
  });
});
